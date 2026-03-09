const CACHE = 'jotma-v17';
const SHELL = ['/', '/index.html', '/manifest.json', '/assets/icon-192.png', '/assets/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('/api/') || !url.startsWith(self.location.origin)) return;
  const pathname = new URL(url).pathname;
  const alwaysFresh = e.request.mode === 'navigate'
    || pathname === '/'
    || pathname.endsWith('.html')
    || pathname.endsWith('.js')
    || pathname.endsWith('.css');

  if (alwaysFresh) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached || caches.match('/index.html'));
      return cached || network;
    })
  );
});
