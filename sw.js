/* Bump this on any deploy that changes a cached asset. It's the only thing
 * that makes the browser notice sw.js itself has changed, which is what
 * triggers install -> activate -> clients.claim and purges the old cache.
 * Without a bump, a device that's already installed the worker can keep
 * serving what it fetched on day one indefinitely. */
var CACHE = 'beer-darts-v8';
var ASSETS = ['./', './index.html', './styles.css', './icon.svg', './manifest.webmanifest',
  './js/checkout.js', './js/ui.js', './js/x01.js', './js/cricket.js', './js/app.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Network first, fall back to cache so the app keeps working with no signal.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (m) { return m || caches.match('./index.html'); });
    })
  );
});
