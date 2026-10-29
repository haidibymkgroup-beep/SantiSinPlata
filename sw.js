/* SantiSinPlata · service worker: deja la app disponible sin internet.
   Sube el número de CACHE cuando publiques cambios para que los celulares se actualicen. */
'use strict';
const CACHE = 'santisinplata-v3';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/money.js', 'js/dates.js', 'js/validators.js', 'js/domain.js', 'js/store.js', 'js/fondo.js', 'js/intro.js', 'js/charts.js',
  'js/ui.js', 'js/vistas.js', 'js/planear.js', 'js/deudas.js', 'js/app.js',
  'img/marca-h.png', 'img/marca-texto.png', 'img/logo-marca.png', 'img/logo-marca-oscuro.png',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Responde desde la copia local y la refresca en segundo plano (la actualización se ve en la siguiente apertura)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const red = fetch(req).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return r;
      }).catch(() => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return hit || red;
    })
  );
});
