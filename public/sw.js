const CACHE = 'pessaro-crm-v2';
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
  // Cache API solo soporta http(s). chrome-extension://, data:, blob:, ws://,
  // wss:, chrome:, file:, etc. lanzan TypeError en cache.put().
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Solo GET es cacheable. POST/PUT/DELETE/PATCH no se cachean.
  if (e.request.method !== 'GET') return;

  // Bypass para Supabase: siempre red, nunca cache (datos en tiempo real).
  if (url.hostname.includes('supabase.co')) return;

  // Bypass para Meta/WhatsApp Graph API (por si existieran).
  if (url.hostname.includes('graph.facebook.com')) return;

  // ── Stale-while-revalidate para el resto ──
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          // Solo cachear respuestas básicas/exitosas (same-origin)
          if (res && res.ok && res.type === 'basic') {
            // Defensivo: si por cualquier motivo el put falla, no romper el SW
            cache.put(e.request, res.clone()).catch(() => {});
          }
          return res;
        }).catch(() => cached); // Offline: fallback al cache
        return cached || network;
      })
    ).catch(() => fetch(e.request)) // Si el SW falla, ir directo a red
  );
});
