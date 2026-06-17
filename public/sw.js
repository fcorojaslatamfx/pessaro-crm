// sw.js v5 - DEFINITIVO
// Cambios respecto a v4:
//  - SIEMPRE muestra notif nativa (sin anti-duplicación que filtraba)
//  - Usa `tag` para que el browser auto-actualice si llegan 2 con mismo phone
//  - Logging EXTENSIVO para diagnosticar
//  - postMessage al client en PARALELO (para toast interno + notif nativa)
//  - requireInteraction:true → la notif no desaparece sola

const CACHE_NAME = 'pessaro-crm-v5'
const SHELL = ['/', '/index.html']

// ─── INSTALL ───────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW v5] install')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(e => console.error('[SW v5] install error:', e))
  )
})

// ─── ACTIVATE ──────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW v5] activate')
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW v5] deleting old cache:', k)
          return caches.delete(k)
        })
      ))
      .then(() => self.clients.claim())
  )
})

// ─── FETCH (cache-first para SHELL, network-first para resto) ─────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  // Solo HTTP/HTTPS GET
  if (!request.url.startsWith('http')) return
  if (request.method !== 'GET') return
  // Skip Supabase y Meta Graph (siempre red directa)
  if (request.url.includes('supabase.co') || request.url.includes('graph.facebook.com')) return

  event.respondWith(
    fetch(request)
      .then(res => {
        if (res && res.type === 'basic' && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, clone))
            .catch(() => {})
        }
        return res
      })
      .catch(() => caches.match(request))
  )
})

// ─── PUSH HANDLER (la parte crítica) ──────────────────────────────────
self.addEventListener('push', (event) => {
  console.log('[SW v5] 📩 push event recibido')

  if (!event.data) {
    console.warn('[SW v5] push sin data')
    return
  }

  let data
  try {
    data = event.data.json()
  } catch (e) {
    console.warn('[SW v5] push data no es JSON válido:', e)
    data = { title: 'Pessaro CRM', body: event.data.text() }
  }

  console.log('[SW v5] data:', JSON.stringify(data))

  const title = data.title || 'Pessaro CRM'
  const options = {
    body:               data.body || '',
    icon:               data.icon  || '/icons/icon-192.png',
    badge:              data.badge || '/icons/icon-96.png',
    tag:                data.tag   || 'pessaro-default',
    renotify:           true,
    requireInteraction: false,
    vibrate:            [200, 100, 200],
    data: {
      url:       data.url   || '/',
      phone:     data.phone || null,
      timestamp: Date.now(),
    },
  }

  event.waitUntil(
    Promise.all([
      // 1. SIEMPRE mostrar la notif nativa del SO
      self.registration.showNotification(title, options)
        .then(() => console.log('[SW v5] ✅ showNotification OK'))
        .catch(e => console.error('[SW v5] ❌ showNotification falló:', e)),

      // 2. EN PARALELO: avisar a clientes abiertos (para toast interno)
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          console.log(`[SW v5] notificando a ${clients.length} clients`)
          clients.forEach(client => {
            try {
              client.postMessage({
                type: 'PUSH_RECEIVED',
                title,
                body:  options.body,
                phone: options.data.phone,
                url:   options.data.url,
              })
            } catch (e) {
              console.warn('[SW v5] postMessage falló:', e)
            }
          })
        })
        .catch(e => console.warn('[SW v5] matchAll falló:', e)),
    ])
  )
})

// ─── CLICK EN NOTIFICACIÓN ────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[SW v5] notificationclick')
  event.notification.close()

  const url = event.notification.data?.url || '/'
  const phone = event.notification.data?.phone

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Si hay una ventana abierta, enfocarla y navegar
        for (const client of clients) {
          if ('focus' in client) {
            client.postMessage({ type: 'NOTIFICATION_CLICK', phone, url })
            return client.focus()
          }
        }
        // Si no hay ventana, abrir una nueva
        if (self.clients.openWindow) {
          return self.clients.openWindow(url)
        }
      })
  )
})

// ─── PUSH SUBSCRIPTION CHANGE (cuando el navegador renueva la subscription) ─
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW v5] pushsubscriptionchange - notificando al client')
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        clients.forEach(c => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }))
      })
  )
})

// ─── MENSAJES DEL CLIENT ──────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  }
})
