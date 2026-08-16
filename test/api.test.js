process.env.JWT_SECRET = 'chave-de-teste';
process.env.PORT = '3999';
process.env.EMAIL_SUPERVISOR_INICIAL = 'supervisor@exemplo.com';
process.env.NOME_SUPERVISOR_INICIAL = 'Supervisor';
process.env.SENHA_SUPERVISOR_INICIAL = 'admin123';
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');

const negocio = require('../src/services/negocio');

(async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri('metasvendascinipgo');
  require(path.join(__dirname, '..', 'src', 'server.js'));

  const BASE = 'http://localhost:3999';
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  await esperar(3500);

  let passou = 0;
  let falhou = 0;
  let cookies = '';

  async function req(metodo, url, corpo) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookies) headers.Cookie = cookies;
    const r = await fetch(BASE + url, {
      method: metodo,
      headers,
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    if (sc.length) cookies = sc.map((c) => c.split(';')[0]).join('; ');
    let j = null;
    try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, j };
  }

  async function testar(nome, fn) {
    try {
      await fn();
      passou++;
      console.log('OK     ' + nome);
    } catch (e) {
      falhou++;
      console.log('FALHOU ' + nome + ' -> ' + e.message);
    }
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'asserção falhou');
  }
  function proximo(cond, msg) {
    if (cond) return cond;
    throw new Error(msg);
  }

  await testar('login supervisor inicial', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'supervisor@exemplo.com', senha: 'admin123' });
    assert(r.ok && r.j.perfil === 'supervisor', 'login supervisor: ' + JSON.stringify(r.j));
  });

  await testar('sem sessao nao acessa /api/me/dashboard', async () => {
    cookies = '';
    const r = await req('GET', '/api/me/dashboard');
    assert(r.status === 401, 'deveria ser 401, veio ' + r.status);
    cookies = '';
  });

  await testar('criar vendedor Darci', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'supervisor@exemplo.com', senha: 'admin123' });
    const c = await req('POST', '/api/supervisor/usuarios', { nome: 'Darci', setor: '313', email: 'darci@exemplo.com', senha: 'darci123', perfil: 'vendedor' });
    assert(c.ok && c.j.nome === 'Darci', 'criar: ' + JSON.stringify(c.j));
    global.idDarci = c.j.id;
  });

  await testar('definir meta do vendedor pelo supervisor', async () => {
    const r = await req('PUT', '/api/supervisor/usuarios/' + global.idDarci + '/meta', { anoMes: negocio.chaveMesHoje(), meta: 4350 });
    assert(r.ok && r.j.meta === 4350, 'meta: ' + JSON.stringify(r.j));
  });

  await testar('vendedor desativado nao faz login', async () => {
    const c = await req('PUT', '/api/supervisor/usuarios/' + global.idDarci, { ativo: false });
    assert(c.ok, 'desativar: ' + JSON.stringify(c.j));
    const l = await req('POST', '/api/auth/login', { email: 'darci@exemplo.com', senha: 'darci123' });
    assert(!l.ok && l.status === 403, 'login inativo deveria dar 403');
    await req('PUT', '/api/supervisor/usuarios/' + global.idDarci, { ativo: true });
  });

  await testar('login do vendedor', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'darci@exemplo.com', senha: 'darci123' });
    assert(r.ok && r.j.perfil === 'vendedor', 'login vendedor: ' + JSON.stringify(r.j));
  });

  await testar('dashboard vendedor com meta', async () => {
    const r = await req('GET', '/api/me/dashboard');
    assert(r.ok, 'dashboard: ' + JSON.stringify(r.j));
    assert(r.j.meta === 4350, 'meta deveria ser 4350, veio ' + r.j.meta);
    assert(r.j.mes === negocio.chaveMesHoje(), 'mes de trabalho deveria ser o atual');
    assert(r.j.calc && typeof r.j.calc.utMes === 'number', 'sem calc');
  });

  await testar('lancar total acumulado', async () => {
    const r1 = await req('POST', '/api/me/lancar', { total: 1400 });
    assert(r1.ok && r1.j.total === 1400, 'lancar 1: ' + JSON.stringify(r1.j));
    const r2 = await req('POST', '/api/me/lancar', { total: 1500.5 });
    assert(r2.ok && r2.j.total === 1500.5, 'lancar 2: ' + JSON.stringify(r2.j));
  });

  await testar('vendedor pode ajustar a propria meta', async () => {
    const r = await req('POST', '/api/me/meta', { meta: 4300 });
    assert(r.ok && r.j.meta === 4300, 'meta vendedor: ' + JSON.stringify(r.j));
  });

  await testar('trocar a propria senha', async () => {
    const t = await req('POST', '/api/auth/trocar-senha', { senhaAtual: 'darci123', novaSenha: 'darci456' });
    assert(t.ok, 'trocar senha: ' + JSON.stringify(t.j));
    const l1 = await req('POST', '/api/auth/login', { email: 'darci@exemplo.com', senha: 'darci123' });
    assert(!l1.ok, 'senha antiga nao deveria funcionar');
    const l2 = await req('POST', '/api/auth/login', { email: 'darci@exemplo.com', senha: 'darci456' });
    assert(l2.ok, 'login com senha nova: ' + JSON.stringify(l2.j));
    const errada = await req('POST', '/api/auth/trocar-senha', { senhaAtual: 'errada', novaSenha: 'x123' });
    assert(!errada.ok, 'senha atual errada deveria falhar');
    await req('POST', '/api/auth/trocar-senha', { senhaAtual: 'darci456', novaSenha: 'darci123' });
  });

  await testar('vendedor nao acessa rotas de supervisor', async () => {
    const r = await req('GET', '/api/supervisor/dashboard');
    assert(r.status === 403, 'deveria ser 403, veio ' + r.status);
  });

  await testar('painel geral do supervisor', async () => {
    await req('POST', '/api/auth/login', { email: 'supervisor@exemplo.com', senha: 'admin123' });
    const r = await req('GET', '/api/supervisor/dashboard');
    assert(r.ok && r.j.linhas.length === 1, 'deveria ter 1 vendedor: ' + JSON.stringify(r.j));
    assert(r.j.linhas[0].nome === 'Darci', 'vendedor errado');
    assert(r.j.linhas[0].meta === 4300 && r.j.linhas[0].atingido === 1500.5, 'meta/atingido: ' + JSON.stringify(r.j.linhas[0]));
  });

  await testar('relatorio do mes atual', async () => {
    const mes = negocio.chaveMesHoje();
    const r = await req('GET', '/api/supervisor/relatorios?de=' + mes + '&ate=' + mes);
    assert(r.ok && r.j.meses.length === 1, 'relatorio: ' + JSON.stringify(r.j));
    assert(r.j.meses[0].meta === 4300 && r.j.meses[0].atingido === 1500.5, 'relatorio valores: ' + JSON.stringify(r.j.meses[0]));
  });

  await testar('fechar mes avanca para o proximo', async () => {
    const r = await req('POST', '/api/me/fechar-mes');
    assert(r.ok && r.j.dashboard.mes === negocio.proximoMes(negocio.chaveMesHoje()), 'mes deveria ser o proximo: ' + JSON.stringify(r.j.dashboard));
    assert(r.j.dashboard.historico.length >= 1, 'historico deveria ter o mes fechado');
  });

  await testar('relatorio de 12 meses inclui mes fechado', async () => {
    const mes = negocio.chaveMesHoje();
    const de = negocio.chaveMesHoje();
    const r = await req('GET', '/api/supervisor/relatorios?de=' + de + '&ate=' + mes);
    assert(r.ok && r.j.totalAtingido === 1500.5, 'total atingido: ' + JSON.stringify(r.j));
  });

  await testar('logica: agosto 2026 (14/08, meta 4350, vendas 1400)', async () => {
    const c = negocio.calcular(4350, 1400, '2026-08', new Date(2026, 7, 14));
    assert(c.utMes === 21, 'utMes deveria ser 21, veio ' + c.utMes);
    assert(c.trab === 9, 'trabalhados deveria ser 9, veio ' + c.trab);
    assert(c.rest === 12, 'restantes deveria ser 12, veio ' + c.rest);
    assert(Math.abs(c.tendencia - 75.1) < 0.1, 'tendencia deveria ser ~75.1, veio ' + c.tendencia);
    assert(Math.abs(c.metaDiaria - 245.83) < 0.01, 'meta diaria deveria ser ~245.83, veio ' + c.metaDiaria);
  });

  await testar('logica: mes passado conta todos os dias uteis', async () => {
    const c = negocio.calcular(4000, 3800, '2026-01', new Date(2026, 7, 14));
    assert(c.trab === c.utMes, 'trabalhados deveria ser igual a utMes (mês passado)');
    assert(c.rest === 0, 'restantes deveria ser 0 (mês passado)');
  });

  console.log('\nResultado: ' + passou + ' ok, ' + falhou + ' falhas');
  await mongo.stop();
  process.exit(falhou ? 1 : 0);
})().catch((e) => {
  console.error('Falha no harness de teste:', e);
  process.exit(1);
});
