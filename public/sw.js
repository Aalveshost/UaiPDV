const CACHE_NAME = 'uai-pdv-v2.5.4';

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
  // Apenas requisições GET do nosso próprio domínio, ignorando Supabase/API para evitar loops
  if (
    event.request.method !== 'GET' || 
    !event.request.url.startsWith(self.location.origin) ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('_next/data')
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
      });
    })
  );
});
