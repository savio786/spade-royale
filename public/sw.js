// Spade Haven service worker: caches the app shell so it opens offline (bots work offline).
const CACHE = 'spade-haven-v3';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icons/icon.svg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.pathname.endsWith('/ws')) return;
  const store = (res) => { if (res.ok && url.origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };
  // built files have a fingerprint in their name and never change: open them straight from the saved copy
  if (url.origin === location.origin && url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(store)));
    return;
  }
  // the page itself: ask the network, but do not make the player wait more than 2.5 s when the saved copy is there
  if (req.mode === 'navigate') {
    e.respondWith(new Promise((resolve) => {
      let done = false;
      const fromCache = () => caches.match(req).then((r) => r || caches.match('./index.html'));
      const t = setTimeout(() => fromCache().then((r) => { if (r && !done) { done = true; resolve(r); } }), 2500);
      fetch(req).then(store).then((r) => { clearTimeout(t); if (!done) { done = true; resolve(r); } }).catch(() => { clearTimeout(t); fromCache().then((r) => { if (!done) { done = true; resolve(r || Response.error()); } }); });
    }));
    return;
  }
  e.respondWith(fetch(req).then(store).catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
});
