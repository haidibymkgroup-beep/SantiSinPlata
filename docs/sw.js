/* SantiSinPlata · service worker (generado en cada compilación: la lista y la versión cambian solas) */
'use strict';
const CACHE = 'santisinplata-react-c6857b411f';
const ARCHIVOS = ["./","apple-touch-icon.png","assets/index-k9e0X73x.js","assets/logo-marca--QP1UbGP.png","assets/logo-marca-oscuro-CUZfPwzB.png","assets/marca-h-DtdNNbsA.png","assets/marca-texto-CmrpArIF.png","assets/style-CQr5syCz.css","icon-192.png","icon-512.png","icon-maskable-512.png","index.html","manifest.webmanifest"];

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

// Responde desde la copia local y la refresca en segundo plano
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const red = fetch(req).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return r;
      }).catch(() => hit || (req.mode === 'navigate' ? caches.match('./') : undefined));
      return hit || red;
    })
  );
});
