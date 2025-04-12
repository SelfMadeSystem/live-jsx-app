// why does adding this `export {};` make the "cannot redeclare block-scoped
// variable" error go away? it literally does nothing
export {};
declare let self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'v1';

console.log('Service Worker loaded');

const filesToCacheImmediately = ['/'];

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Caching files...', filesToCacheImmediately);
      await cache.addAll(filesToCacheImmediately);
    })(),
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log(`Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

/**
 * Fetches a request and caches the response.
 * If we can't fetch the request, it returns the cached response if available.
 */
async function fetchAndCache(request: Request) {
  const response = await fetch(request).catch(() => null);

  if (!response) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    console.error('Network error and no cached response found', request.url);
    return new Response('Network error', { status: 408 });
  }

  if (response.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    console.log('cached');
    await cache.put(request, response.clone());
  } else if (response.status === 304) {
    console.warn('Not modified, but not cached', request.url);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

function shouldCache(request: Request) {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);

  // Check if the request is from esm.sh
  if (url.hostname === 'esm.sh') {
    // We don't want to overwhelm esm.sh with requests
    return true;
  }
  // Check if the request is on the same origin as the service worker
  if (
    url.origin === location.origin &&
    (url.pathname.startsWith('/esm/') ||
      url.pathname.startsWith('/min/') ||
      url.pathname.startsWith('/vfs/') ||
      url.pathname.startsWith('/node_modules/'))
  ) {
    return true;
  }
  // Otherwise, just fetch the request
  return false;
}

async function fetchIfNotCached(request: Request) {
  const response = await caches.match(request);

  if (response) {
    // If the response is in the cache, return it
    return response;
  }
  if (dontEverFetch(request)) {
    // If we don't want to fetch the request, return a 404
    return new Response('Not found', { status: 404 });
  }

  // If not, fetch and cache it
  return fetchAndCache(request);
}

function dontEverFetch(request: Request) {
  const url = new URL(request.url);

  if (url.hostname === location.hostname && url.pathname.startsWith('/vfs/')) {
    // We don't ever want to fetch these requests
    return true;
  }

  return false;
}

function dontEverCache(request: Request) {
  const url = new URL(request.url);

  // We don't want to cache requests that are not http or https
  // Most commonly, this is a data URL or a chrome-extension URL
  return url.protocol !== 'http:' && url.protocol !== 'https:';
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (dontEverCache(request)) {
    // We don't want to cache this request
    console.log('not fetching...', request.url);
    return;
  }

  console.log('Service Worker fetching...', request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('/');

        const isLocalhost =
          location.hostname === 'localhost' ||
          location.hostname === '127.0.0.1';

        if (cachedIndex) {
          const offlineMessage = isLocalhost
            ? 'You forgot to start the dev server'
            : 'You are offline';

          // Modify the cached index.html to inject the toast script
          const indexText = await cachedIndex.text();
          const modifiedIndex = indexText.replace(
            '</body>',
            /*html*/ `<script>
              window.addEventListener('load', () => {
                if (typeof toast === 'function') {
                  toast('${offlineMessage}', {
                    type: 'error',
                  });
                } else {
                  console.warn('Toast function not found.');
                  ${
                    isLocalhost
                      ? /*js*/ `document.body.innerText = "You'll \
have to refresh the tab once more with the dev server running to be able to \
view it without the dev server. This is because the development scripts don't \
get cached until after the service worker loads, but the service worker loads \
after the development scripts load. After one refresh, it should work as intended.";`
                      : ''
                  }
                  alert('${offlineMessage}');
                }
              });
            </script></body>`,
          );

          return new Response(modifiedIndex, {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        // Fallback if index.html is not cached
        return new Response(
          `<h1>${isLocalhost ? 'You forgot to start the dev server' : 'You are offline'}</h1>`,
          { headers: { 'Content-Type': 'text/html' } },
        );
      }),
    );
    return;
  }
  const shouldCacheRequest = shouldCache(request);

  if (shouldCacheRequest) {
    event.respondWith(fetchIfNotCached(request));
  } else {
    // only respond with cached response if we can't fetch the request
    event.respondWith(fetchAndCache(request));
    return;
  }
});
