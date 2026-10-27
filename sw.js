// Service worker de TchoProVip : garde l'application disponible sans internet.
// Changez CACHE_VERSION à chaque mise en ligne pour que les tablettes récupèrent la nouvelle version.

const CACHE_VERSION = 'tchoprovip-v0.1.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/domain.js',
  './js/seed.js',
  './js/store.js',
  './js/sync.js',
  './js/ui.js',
  './js/views/login.js',
  './js/views/salle.js',
  './js/views/commande.js',
  './js/views/cuisine.js',
  './js/views/reglages.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const FONT_CACHE = 'tchoprovip-fonts';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Polices Google : servies depuis le cache, mises à jour en arrière-plan.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Pages : réseau d'abord (pour les mises à jour), cache si pas d'internet.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  // Fichiers de l'application : cache d'abord, réseau sinon.
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
