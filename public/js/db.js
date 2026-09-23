(function () {
  const DB_NOME = 'vendacerta-dados';
  const DB_VER = 1;
  const STORE = 'cache';

  let dbPromise = null;

  function abrir() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      try {
        const req = indexedDB.open(DB_NOME, DB_VER);
        req.onupgradeneeded = function () {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'chave' });
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      } catch (e) { reject(e); }
    });
    return dbPromise;
  }

  function transacao(modo, fn) {
    return abrir().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          const tx = db.transaction(STORE, modo);
          const store = tx.objectStore(STORE);
          const r = fn(store);
          tx.oncomplete = function () { resolve(r && r.result !== undefined ? r.result : undefined); };
          tx.onerror = function () { reject(tx.error); };
          tx.onabort = function () { reject(tx.error); };
        } catch (e) { reject(e); }
      });
    });
  }

  function cacheSet(chave, valor) {
    return transacao('readwrite', function (store) {
      store.put({ chave: chave, valor: JSON.stringify(valor), ts: Date.now() });
    }).catch(function () {});
  }

  function cacheGet(chave) {
    return transacao('readonly', function (store) {
      return store.get(chave);
    }).then(function (registro) {
      if (!registro) return null;
      try { return { valor: JSON.parse(registro.valor), ts: registro.ts }; }
      catch (e) { return null; }
    }).catch(function () { return null; });
  }

  function cacheLimpar() {
    return transacao('readwrite', function (store) {
      store.clear();
    }).catch(function () {});
  }

  window.localCache = { cacheSet, cacheGet, cacheLimpar };
})();