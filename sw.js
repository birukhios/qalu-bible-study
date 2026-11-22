// Offline support.
// App files (SHELL): network first, so an update is picked up at once, with the saved copy used when offline.
// Bible text, commentary, notes and the Hebrew and Greek words: saved the first time they are opened (or all at
// once from the Offline screen) and read from the device after that. They live in their own storage (DATA), which
// app updates do not clear; DATA's name changes only when the data files themselves change.
const CACHE = 'qalu-v43';
const DATA = 'qalu-data-1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'icon.svg', 'manifest.webmanifest', 'data/content.json',
  'data/fathers/index.json', 'data/land.json', 'data/offline.json', 'data/maps.json', 'data/geo/places.json', 'data/geo/routes.json', 'data/geo/atlas.json', 'data/geo/calib.json', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== DATA).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Book, chapter and dictionary files: data/<folder>/<n>.json, data/<folder>/<n>/<n>.json and data/interlinear/lexicon.json.
const isData = (path) => /\/data\/\w+\/(\d+\/)?\d+\.json$/.test(path) || /\/data\/interlinear\/lexicon\.json$/.test(path);

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (isData(url.pathname)) {
    event.respondWith(caches.open(DATA).then((cache) => cache.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request).then((response) => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }))));
    return;
  }
  // 'no-cache' makes the browser check with the server each time, so an update never mixes new code with old content.
  event.respondWith(fetch(event.request, { cache: 'no-cache' }).then((response) => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || (event.request.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
