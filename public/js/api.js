async function api(url, opts) {
  const opcoes = Object.assign({ credentials: 'same-origin' }, opts);
  if (opcoes.body && typeof opcoes.body !== 'string') {
    opcoes.headers = Object.assign({ 'Content-Type': 'application/json' }, opcoes.headers || {});
    opcoes.body = JSON.stringify(opcoes.body);
  }
  const metodo = String(opcoes.method || 'GET').toUpperCase();
  let res;
  try {
    res = await fetch(url, opcoes);
  } catch (e) {
    throw new Error('Sem conexão com o servidor');
  }
  let corpo = null;
  try { corpo = await res.json(); } catch (e) { corpo = null; }
  if (!res.ok) {
    const err = new Error((corpo && corpo.erro) || 'Erro no servidor');
    err.status = res.status;
    throw err;
  }
  if (metodo !== 'GET' && window.localCache) {
    window.localCache.cacheLimpar();
  }
  return corpo;
}

async function apiCacheavel(url) {
  const d = await api(url);
  if (window.localCache) window.localCache.cacheSet(url, d);
  return d;
}

async function cacheLeia(url) {
  if (!window.localCache) return null;
  const r = await window.localCache.cacheGet(url);
  return r ? r.valor : null;
}

async function sairSistema() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
  window.location.href = '/login.html';
}
