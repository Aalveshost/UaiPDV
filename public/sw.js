const CACHE_NAME = 'uai-pdv-v4.1.1';

// Estratégia: Network First (Tenta sempre a rede para ter o código mais novo, se falhar usa o cache)
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

  // Network First Strategy
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      // Se a resposta for válida, salva no cache e entrega
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Se a rede falhar, tenta buscar no cache
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Se falhar tudo (Rede OFF + Cache vazio), tenta página inicial
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline and no cache available', { status: 503 });
      });
    })
  );
});
