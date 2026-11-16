/* The cache is named after the build. The image build (see Dockerfile)
 * replaces the placeholder below with a hash of every file it ships, so any
 * change to the app changes the bytes of sw.js -- which is the only thing
 * that makes a browser install a new worker, precache the new files and
 * drop the old cache. There is nothing to bump by hand. Served unbuilt,
 * straight from the working tree, the name is just the placeholder: the
 * precache then never refreshes, but requests are network-first, so a
 * reload still gets what is on disk. */
var CACHE = 'beer-darts-__BUILD__';

/* What a first visit stores so the app can start with no signal. Keep in
 * step with the <script> tags in index.html. */
var ASSETS = ['./', './index.html', './styles.css', './icon.svg', './img/bad-news-beers.png', './manifest.webmanifest',
  './js/projector.js', './js/league.js', './js/checkout.js', './js/ui.js', './js/x01.js', './js/cricket.js',
  './js/mbc.js', './js/app.js'];

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

/* Network first, falling back to the cache so the app keeps working with no
 * signal. Only good same-origin responses are kept: a 404 or a 500 stored
 * here would be served back later as if it were the file. */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (m) {
        if (m) return m;
        /* The app shell stands in for a page that was never cached
         * (index.html?debug, say) -- but not for a script or an image. */
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
