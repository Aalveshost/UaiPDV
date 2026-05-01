const CACHE_NAME = 'uai-pdv-v2.5.6';

// Estratégia: Cache First (Tenta o que está salvo, se não tiver, busca na rede e salva)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorar APKs, Supabase, hot-reloading e assets de desenvolvimento
  const isDevAsset = 
    event.request.url.includes('/_next/') || 
    event.request.url.includes('webpack-hmr') ||
    event.request.url.includes('browser-sync') ||
    event.request.url.includes('hot-update');

  if (
    event.request.method !== 'GET' || 
    !event.request.url.startsWith(self.location.origin) ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('.apk') ||
    isDevAsset
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Se a resposta for válida, salva no cache para a próxima vez
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Se falhar a rede (Offline) e não tiver no cache, tenta entregar a página inicial
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Network error', { status: 408, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});
