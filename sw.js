// Offline support. App files: network first, cached copy as fallback. Bible data: cached after first use.
const CACHE = 'qalu-v16';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'icon.svg', 'manifest.webmanifest', 'data/content.json', 'data/fathers/index.json', 'data/land.json', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  const store = (response) => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); }
    return response;
  };
  const bigData = /\/data\/\w+\/(\d+\/)?\d+\.json$/.test(url.pathname);
  if (bigData) {
    event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request).then(store)));
  } else {
    // 'no-cache' makes the browser check with the server each time, so an update never mixes new code with old content.
    event.respondWith(fetch(event.request, { cache: 'no-cache' }).then(store).catch(() => caches.match(event.request)));
  }
});
