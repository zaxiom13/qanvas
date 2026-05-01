const CACHE_NAME = 'qanvas5-pwa-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];
const OPTIONAL_SHELL = ['/qanvas-default-backend.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).then(() => Promise.allSettled(OPTIONAL_SHELL.map((path) => cache.add(path)))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedIndex = await caches.match('/index.html');
        if (cachedIndex) return cachedIndex;
        throw new Error('Qanvas app shell is not cached.');
      }),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname) || OPTIONAL_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          void fetch(request).then((response) => {
            if (response.ok) void cache.put(request, response.clone());
          });
          return cached;
        }

        const fetched = await fetch(request);
        if (fetched.ok) await cache.put(request, fetched.clone());
        return fetched;
      }),
    );
  }
});
