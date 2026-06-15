const CACHE = 'pessaro-crm-v3';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // ── Filtros críticos: NO interceptar requests que no podemos cachear ──
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('graph.facebook.com')) return;

  // ── Stale-while-revalidate ──
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          if (res && res.ok && res.type === 'basic') {
            cache.put(e.request, res.clone()).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    ).catch(() => fetch(e.request))
  );
});

// ── Push notifications (preparado para Web Push futuro) ──────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'Pessaro CRM', body: 'Nuevo mensaje' }; }
  const title = data.title || 'Pessaro CRM';
  const opts = {
    body: data.body || 'Tienes un mensaje',
    icon: data.icon || 'https://pessaro.cl/images/logo-256.webp',
    badge: data.badge || 'https://pessaro.cl/images/logo-256.webp',
    tag: data.tag || 'pessaro-notif',
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/', phone: data.phone },
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

// ── Click en notificación: enfocar/abrir la PWA en el chat correcto ──────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Si hay una ventana abierta, enfocarla y navegar
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', phone: e.notification.data?.phone });
          return client.focus();
        }
      }
      // Si no hay ninguna abierta, abrir nueva
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Mensaje desde la app para limpiar cache (post-logout) ────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
