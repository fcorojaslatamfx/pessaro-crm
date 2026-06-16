const CACHE = 'pessaro-crm-v4';
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

  // Filtros: solo http/https GET, no Supabase ni Meta
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('graph.facebook.com')) return;

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

// ── Push handler con anti-duplicación ──────────────────────────────────────
// Si hay un cliente visible y enfocado, NO muestra notif (el cliente la maneja vía realtime)
// Si NO hay cliente visible (PWA cerrada/minimizada), SÍ muestra notif nativa
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let data = {};
    try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'Pessaro CRM', body: 'Nuevo mensaje' }; }

    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visibleClient = allClients.find(c => c.visibilityState === 'visible');

    if (visibleClient) {
      // Hay PWA abierta y visible: avisar al cliente, dejar que él decida si mostrar in-app notif
      // (el sistema local de realtime ya muestra sonido/vibración/Notification)
      allClients.forEach(c => c.postMessage({ type: 'PUSH_RECEIVED', data }));
      return;
    }

    // PWA cerrada o en background: mostrar notif desde el SW
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
    await self.registration.showNotification(title, opts);
  })());
});

// Click en notif: enfocar/abrir PWA + postMessage con el phone para navegar
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || '/';
  const phone = e.notification.data?.phone;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', phone });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// Re-suscribir si el endpoint cambia (rare pero pasa)
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    allClients.forEach(c => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
  })());
});

// Mensajes desde la app
self.addEventListener('message', e => {
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
