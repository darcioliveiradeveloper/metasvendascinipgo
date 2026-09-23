/* VendaCerta — Service Worker
 * Modo offline: armazena o shell do app e respostas da API em cache.
 * Dados para exibição rápida ficam também no IndexedDB (public/js/db.js). */
const CACHE = 'vendacerta-shell-v1';

const SHELL = [
  '/login.html',
  '/app.html',
  '/css/style.css',
  '/js/db.js',
  '/js/api.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const mesmoOrigem = url.origin === self.location.origin;

  if (url.pathname.indexOf('/api/') === 0) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .catch(() => {
          const alvo = url.pathname.indexOf('login') !== -1 ? '/login.html' : '/app.html';
          return caches.match(req).then((r) => r || caches.match(alvo));
        })
    );
    return;
  }

  if (mesmoOrigem) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const rede = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || rede;
      })
    );
    return;
  }

  e.respondWith(
    fetch(req).then((res) => {
      const clone = res.clone();
      caches.open(CACHE).then((c) => c.put(req, clone));
      return res;
    }).catch(() => caches.match(req))
  );
});