// why does adding this `export {};` make the "cannot redeclare block-scoped
// variable" error go away? it literally does nothing
export {};
declare let self: ServiceWorkerGlobalScope;

console.log('Service Worker loaded');

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open('v1').then(cache => {
      return cache.put(
        new Request('/vfs/test.json', { cache: 'reload' }), // Use a Request object
        new Response(JSON.stringify({ test: 'test' })),
      );
    }),
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  console.log('Service Worker fetching...', event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Check if the app is running on localhost
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

        // Return a custom offline message based on the hostname
        return new Response(
          `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Offline</title>
          </head>
          <body>
            <h1>${isLocalhost ? 'You forgot to start the dev server' : 'You are offline'}</h1>
          </body>
          </html>
          `,
          { headers: { 'Content-Type': 'text/html' } },
        );
      }),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    }),
  );
});
