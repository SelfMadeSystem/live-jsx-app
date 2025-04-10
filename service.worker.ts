// why does adding this `export {};` make the "cannot redeclare block-scoped
// variable" error go away? it literally does nothing
export {};
declare let self: ServiceWorkerGlobalScope;

console.log('Service Worker loaded');

const filesToCacheImmediately = ['/'];

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open('v1').then(cache => {
      console.log('Caching files...');
      return cache.addAll(filesToCacheImmediately);
    }),
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

const CACHE_NAME = 'v1';
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Fetches a request and caches the response.
 * If the response is already cached, it checks if it's expired.
 * If expired, it fetches a new response and caches it.
 * If not expired, it returns the cached response.
 * @param request - The request to fetch.
 * @returns The response from the cache or the network.
 */
async function fetchAndCacheWithExpiry(request: Request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const cachedTime = new Date(
      cachedResponse.headers.get('sw-cache-timestamp') || 0,
    ).getTime();
    const now = Date.now();

    // Check if the cached response has expired
    if (now - cachedTime < CACHE_EXPIRY_TIME) {
      return cachedResponse;
    } else {
      // If expired, delete the cached response
      await cache.delete(request);
    }
  }

  // Fetch and cache the new response
  const response = await fetch(request).catch(() => {
    // If the fetch fails, return the cached response if available
    return cachedResponse || new Response('Network error', { status: 408 });
  });

  if (response.status === 200) {
    const clonedResponse = response.clone();

    // Add a custom header to store the timestamp
    const headers = new Headers(clonedResponse.headers);
    headers.append('sw-cache-timestamp', new Date().toISOString());

    const responseWithTimestamp = new Response(clonedResponse.body, {
      status: clonedResponse.status,
      statusText: clonedResponse.statusText,
      headers,
    });

    await cache.put(request, responseWithTimestamp);
  }

  return response;
}

/**
 * Fetches a request and caches the response with the expiry time.
 */
async function fetchAndCache(request: Request) {
  const response = await fetch(request);

  const cache = await caches.open(CACHE_NAME);

  if (response.status === 200) {
    await cache.put(request, response.clone());
  }

  return response;
}

function shouldCache(request: Request) {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);

  // Check if the request is from skypack
  if (url.hostname === 'cdn.skypack.dev') {
    // We don't want to overwhelm skypack with requests
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

function dontEverFetch(request: Request) {
  const url = new URL(request.url);

  if (url.hostname === location.hostname && url.pathname.startsWith('/vfs/')) {
    // We don't ever want to fetch these requests
    return true;
  }

  return false;
}

self.addEventListener('fetch', event => {
  console.log('Service Worker fetching...', event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
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
  const shouldCacheRequest = shouldCache(event.request);

  if (shouldCacheRequest) {
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) {
          // If the response is in the cache, return it
          return response;
        }
        if (dontEverFetch(event.request)) {
          // If we don't want to fetch the request, return a 404
          return new Response('Not found', { status: 404 });
        }
        // If not, fetch and cache it
        return fetchAndCacheWithExpiry(event.request);
      }),
    );
  } else {
    // only respond with cached response if we can't fetch the request
    event.respondWith(
      fetchAndCache(event.request).catch(async e => {
        return caches.match(event.request).then(response => {
          if (response) {
            return response;
          }
          throw e;
        });
      }),
    );
    return;
  }
});
