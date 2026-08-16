async function api(url, opts) {
  const opcoes = Object.assign({ credentials: 'same-origin' }, opts);
  if (opcoes.body && typeof opcoes.body !== 'string') {
    opcoes.headers = Object.assign({ 'Content-Type': 'application/json' }, opcoes.headers || {});
    opcoes.body = JSON.stringify(opcoes.body);
  }
  let res;
  try {
    res = await fetch(url, opcoes);
  } catch (e) {
    throw new Error('Sem conexão com o servidor');
  }
  let corpo = null;
  try { corpo = await res.json(); } catch (e) { corpo = null; }
  if (!res.ok) {
    throw new Error((corpo && corpo.erro) || 'Erro no servidor');
  }
  return corpo;
}

async function sairSistema() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
  window.location.href = '/login.html';
}
