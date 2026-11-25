// Offline support. App shell is pre-cached; everything else (OCR engine, language data, fonts)
// is cached on first use. Pages are network-first so new versions arrive; assets are cache-first.
// RELEASE: bump VERSION on every deploy. A changed sw.js is how installed apps learn there is an update.
const VERSION = '2.9.1';   // keep equal to js/version.js
const CACHE = 'hopopo-' + VERSION;
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/i18n.js', './js/version.js',
  './js/core/languages.js', './js/core/text.js', './js/core/planner.js', './js/core/scoring.js', './js/core/stats.js', './js/core/packs.js', './js/core/timeline.js',
  './js/data/store.js', './js/data/books.js',
  './js/services/speech.js', './js/services/importers.js', './js/services/ocr.js', './js/services/claude.js', './js/services/audioclip.js', './js/services/engine.js', './js/services/mic.js', './js/services/whisper.js', './js/services/whisper.worker.js',
  './js/ui/dom.js', './js/ui/welcome.js', './js/ui/help.js', './js/ui/home.js', './js/ui/track.js', './js/ui/importFlow.js', './js/ui/session.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

// cache: 'reload' bypasses the browser's HTTP cache, so a new version never pre-caches old files
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || /cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!cacheable) return;
  const fresh = req.mode === 'navigate' || (url.origin === location.origin && /\.(js|css|html)$/.test(url.pathname) && !/\/(ocr|lib)\//.test(url.pathname));
  if (fresh) {   // network first: code updates arrive, cache is the offline fallback
    // no-cache: always revalidate with the server (GitHub Pages lets browsers keep files ~10 min otherwise)
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return r;
  })));
});
