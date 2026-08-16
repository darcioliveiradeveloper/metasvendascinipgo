const $ = (id) => document.getElementById(id);
const fmtQtd = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const fmtPct = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const numFromInput = (txt) => {
  const n = parseFloat(String(txt).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};
const hojeKey = () => {
  const h = new Date();
  return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0');
};
const esc = (txt) => String(txt == null ? '' : txt)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const graficos = {};
function destruirGrafico(id) {
  if (graficos[id]) { graficos[id].destroy(); delete graficos[id]; }
}
function novoGrafico(id, config) {
  destruirGrafico(id);
  graficos[id] = new Chart($(id).getContext('2d'), config);
}

let MEU_USUARIO = null;
let SUP_MES = null;

function init() {
  $('btn-sair').addEventListener('click', sairSistema);
  api('/api/auth/me')
    .then(function (me) {
      MEU_USUARIO = me;
      $('saudacao').textContent = me.nome + (me.setor ? ' - ' + me.setor : '');
      $('perfil-badge').textContent = me.perfil === 'supervisor' ? 'Supervisor' : 'Vendedor';
      if (me.perfil === 'supervisor') {
        iniciarSupervisor();
      } else {
        iniciarVendedor();
      }
    })
    .catch(function () { window.location.href = '/login.html'; });
}

/* ============================= VENDEDOR ============================= */

function iniciarVendedor() {
  $('view-vendedor').classList.remove('hidden');
  $('data-hoje').textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  $('btn-lancar').addEventListener('click', lancarTotal);
  $('btn-meta').addEventListener('click', definirMeta);
  $('btn-iniciar-mes').addEventListener('click', iniciarMesAtual);
  $('btn-fechar-mes').addEventListener('click', fecharMes);
  carregarPainelVendedor();
}

async function carregarPainelVendedor() {
  try {
    const d = await api('/api/me/dashboard');
    renderVendedor(d);
  } catch (e) {
    alert(e.message);
  }
}

function renderVendedor(d) {
  const c = d.calc;
  $('nome-mes').textContent = d.nomeMes;
  $('chip-mes').textContent = c.utMes;
  $('chip-trab').textContent = c.trab;
  $('chip-rest').textContent = c.rest;
  $('meta-valor').textContent = d.meta ? fmtQtd(d.meta) + ' fardos' : '—';
  $('total-valor').textContent = fmtQtd(d.total) + ' fardos';

  const alcPct = Math.min(100, c.atingidoPct);
  $('barra-alc').style.width = alcPct + '%';
  const faltante = d.meta - d.total;
  $('alc-info').textContent = d.meta > 0
    ? (faltante > 0 ? fmtPct(c.atingidoPct) + ' da meta · faltam ' + fmtQtd(faltante) + ' fardos' : 'Meta batida!')
    : 'Defina a meta do mês para acompanhar.';

  const temTend = c.trab > 0 && d.meta > 0;
  $('tend-valor').textContent = temTend ? fmtPct(c.tendencia) : '—';
  $('tend-barra').style.width = (temTend ? Math.min(100, c.tendencia) : 0) + '%';
  $('tend-info').textContent = temTend
    ? 'Média ' + fmtQtd(c.media) + ' fardos/dia × ' + c.utMes + ' dias úteis = ' + fmtQtd(c.projetado) + ' fardos'
    : (c.trab === 0 ? 'Ainda sem dias úteis trabalhados neste mês.' : 'Defina a meta do mês para calcular.');

  const temMetDia = c.rest > 0 && d.meta > 0;
  $('metadia-valor').textContent = temMetDia ? fmtQtd(c.metaDiaria) + ' fardos' : '—';
  $('metadia-info').textContent = temMetDia
    ? (d.meta - d.total > 0 ? fmtQtd(d.meta - d.total) + ' faltantes ÷ ' + c.rest + ' dias úteis' : 'Meta já atingida no mês.')
    : (d.meta > 0 ? 'Não há dias úteis restantes no mês.' : 'Defina a meta do mês para calcular.');

  $('atualizado').textContent = d.atualizadoEm
    ? new Date(d.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Ainda não lançado neste mês';

  $('inp-total').value = d.total || '';
  $('inp-meta').value = d.meta || '';

  const aviso = $('aviso-fechado');
  if (d.fechado) {
    aviso.textContent = 'Este mês está fechado. Abra o próximo mês ou lance no mês seguinte.';
    aviso.classList.remove('hidden');
  } else {
    aviso.classList.add('hidden');
  }

  $('btn-iniciar-mes').classList.toggle('hidden', !(d.mes < hojeKey()));
  $('btn-fechar-mes').disabled = !!d.fechado;
  $('btn-fechar-mes').textContent = d.fechado ? 'Mês fechado' : 'Fechar mês';

  renderHistorico(d.historico);
}

function renderHistorico(hist) {
  const tabela = $('tabela-historico');
  if (!hist.length) {
    tabela.innerHTML = '<tr><td class="vazio">Nenhum mês finalizado ainda.</td></tr>';
    destruirGrafico('grafico-historico');
    return;
  }
  let linhas = '<tr><th>Mês</th><th>Meta</th><th>Atingido</th><th>%</th><th>D.U.</th></tr>';
  hist.forEach(function (h) {
    linhas += '<tr><td>' + h.nomeMes + '</td><td>' + fmtQtd(h.meta) + '</td><td>' + fmtQtd(h.atingido) + '</td><td class="tend">' + fmtPct(h.pct) + '</td><td>' + h.utMes + '</td></tr>';
  });
  tabela.innerHTML = linhas;

  const labels = hist.map((h) => h.nomeMes);
  novoGrafico('grafico-historico', {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Meta', data: hist.map((h) => h.meta), backgroundColor: 'rgba(148,163,184,.55)' },
        { label: 'Vendido', data: hist.map((h) => h.atingido), backgroundColor: '#16a34a' }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

async function lancarTotal() {
  const total = numFromInput($('inp-total').value);
  if (total === null || total < 0) { alert('Informe um valor válido.'); return; }
  try {
    renderVendedor(await api('/api/me/lancar', { method: 'POST', body: { total } }));
  } catch (e) { alert(e.message); }
}

async function definirMeta() {
  const meta = numFromInput($('inp-meta').value);
  if (meta === null || meta < 0) { alert('Informe uma meta válida.'); return; }
  try {
    renderVendedor(await api('/api/me/meta', { method: 'POST', body: { meta } }));
  } catch (e) { alert(e.message); }
}

async function iniciarMesAtual() {
  try {
    renderVendedor(await api('/api/me/iniciar-mes', { method: 'POST' }));
  } catch (e) { alert(e.message); }
}

async function fecharMes() {
  if (!confirm('Fechar o mês atual? Ele vai para o histórico e o próximo mês será aberto.')) return;
  try {
    const r = await api('/api/me/fechar-mes', { method: 'POST' });
    alert(r.fechado.nomeMes + ' foi fechado e salvo no histórico.');
    renderVendedor(r.dashboard);
  } catch (e) { alert(e.message); }
}

/* ============================= SUPERVISOR ============================= */

function iniciarSupervisor() {
  $('view-supervisor').classList.remove('hidden');
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach((x) => x.classList.remove('ativa'));
      t.classList.add('ativa');
      document.querySelectorAll('.aba').forEach(function (a) { a.classList.add('hidden'); });
      $('aba-' + t.dataset.tab).classList.remove('hidden');
      if (t.dataset.tab === 'geral') carregarGeral();
      if (t.dataset.tab === 'vendedores') carregarVendedores();
    });
  });
  $('btn-novo-vendedor').addEventListener('click', function () { abrirModalUsuario(null); });
  $('btn-gerar').addEventListener('click', carregarRelatorio);
  preencherFiltroVendedor();
  carregarGeral();
}

async function carregarGeral() {
  try {
    const d = await api('/api/supervisor/dashboard');
    SUP_MES = d.mes;
    $('sup-nome-mes').textContent = d.nomeMes;
    $('sup-meta').textContent = fmtQtd(d.totalMeta) + ' fardos';
    $('sup-atingido').textContent = fmtQtd(d.totalAtingido) + ' fardos';
    $('sup-pct').textContent = fmtPct(d.pctGeral);

    let linhas = '<tr><th>Vendedor</th><th>Setor</th><th>Meta</th><th>Vendido</th><th>%</th><th></th></tr>';
    d.linhas.forEach(function (l) {
      const tend = l.calc.tendencia > 0 ? ' · tendência ' + fmtPct(l.calc.tendencia) : '';
      linhas += '<tr><td>' + esc(l.nome) + '</td><td>' + esc(l.setor || '—') + '</td><td>' + fmtQtd(l.meta) + '</td><td>' + fmtQtd(l.atingido) + '</td><td class="tend">' + fmtPct(l.calc.atingidoPct) + tend + '</td><td><button class="btn fino" data-meta-sup="' + l.id + '" data-nome="' + esc(l.nome) + '">Meta</button></td></tr>';
    });
    $('tabela-geral').innerHTML = linhas || '<tr><td class="vazio">Nenhum vendedor cadastrado.</td></tr>';

    document.querySelectorAll('[data-meta-sup]').forEach(function (b) {
      b.addEventListener('click', function () {
        const id = b.dataset.metaSup;
        const nome = b.dataset.nome;
        const valor = prompt('Meta em fardos para ' + nome + ' — ' + SUP_MES + ':', '');
        if (valor === null) return;
        const meta = numFromInput(valor);
        if (meta === null || meta < 0) { alert('Valor inválido.'); return; }
        api('/api/supervisor/usuarios/' + id + '/meta', {
          method: 'PUT',
          body: { anoMes: SUP_MES, meta: meta }
        }).then(carregarGeral).catch(function (e) { alert(e.message); });
      });
    });
  } catch (e) { alert(e.message); }
}

async function carregarVendedores() {
  try {
    const lista = await api('/api/supervisor/usuarios');
    const vendedores = lista.filter(function (u) { return u.perfil !== 'supervisor'; });
    let linhas = '<tr><th>Nome</th><th>Setor</th><th>E-mail</th><th>Situação</th><th></th></tr>';
    vendedores.forEach(function (u) {
      linhas += '<tr><td>' + esc(u.nome) + '</td><td>' + esc(u.setor || '—') + '</td><td>' + esc(u.email) + '</td><td>' + (u.ativo ? 'Ativo' : 'Inativo') + '</td><td><button class="btn fino" data-edita="' + u.id + '">Editar</button> <button class="btn fino perigo" data-ativa="' + u.id + '">' + (u.ativo ? 'Desativar' : 'Ativar') + '</button></td></tr>';
    });
    $('tabela-vendedores').innerHTML = linhas || '<tr><td class="vazio">Nenhum vendedor cadastrado.</td></tr>';

    document.querySelectorAll('[data-edita]').forEach(function (b) {
      b.addEventListener('click', function () {
        const u = vendedores.find((x) => x.id === b.dataset.edita);
        abrirModalUsuario(u);
      });
    });
    document.querySelectorAll('[data-ativa]').forEach(function (b) {
      b.addEventListener('click', function () {
        const u = vendedores.find((x) => x.id === b.dataset.ativa);
        api('/api/supervisor/usuarios/' + u.id, {
          method: 'PUT',
          body: { ativo: !u.ativo }
        }).then(carregarVendedores).catch(function (e) { alert(e.message); });
      });
    });
  } catch (e) { alert(e.message); }
}

let MODO_USUARIO = 'novo';
let ID_USUARIO = null;

function abrirModalUsuario(u) {
  MODO_USUARIO = u ? 'editar' : 'novo';
  ID_USUARIO = u ? u.id : null;
  $('modal-usuario-titulo').textContent = u ? 'Editar vendedor' : 'Novo vendedor';
  $('mu-nome').value = u ? u.nome : '';
  $('mu-setor').value = u ? u.setor : '';
  $('mu-email').value = u ? u.email : '';
  $('mu-perfil').value = u ? u.perfil : 'vendedor';
  $('mu-ativo').checked = u ? u.ativo : true;
  $('mu-senha').value = '';
  $('mu-erro').classList.add('hidden');
  $('modal-usuario').classList.remove('hidden');
}

function fecharModalUsuario() {
  $('modal-usuario').classList.add('hidden');
}

async function salvarModalUsuario() {
  const corpo = {
    nome: $('mu-nome').value.trim(),
    setor: $('mu-setor').value.trim(),
    email: $('mu-email').value.trim(),
    perfil: $('mu-perfil').value
  };
  const senha = $('mu-senha').value;
  if (senha) corpo.senha = senha;
  if (MODO_USUARIO === 'novo') corpo.ativo = $('mu-ativo').checked;
  if (!corpo.nome || !corpo.email || (MODO_USUARIO === 'novo' && !senha)) {
    $('mu-erro').textContent = 'Nome, e-mail e senha são obrigatórios para novo vendedor.';
    $('mu-erro').classList.remove('hidden');
    return;
  }
  try {
    if (MODO_USUARIO === 'novo') {
      await api('/api/supervisor/usuarios', { method: 'POST', body: corpo });
    } else {
      await api('/api/supervisor/usuarios/' + ID_USUARIO, { method: 'PUT', body: corpo });
    }
    fecharModalUsuario();
    carregarVendedores();
  } catch (e) {
    $('mu-erro').textContent = e.message;
    $('mu-erro').classList.remove('hidden');
  }
}

/* ============================= RELATÓRIOS ============================= */

function ultimosMeses(n) {
  const hoje = new Date();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    arr.push(dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0'));
  }
  return { de: arr[0], ate: arr[arr.length - 1] };
}

async function carregarRelatorio() {
  const n = Number($('filtro-tipo').value);
  const rango = ultimosMeses(n);
  const usuario = $('filtro-vendedor').value;
  try {
    const url = '/api/supervisor/relatorios?de=' + rango.de + '&ate=' + rango.ate + (usuario ? '&usuario=' + usuario : '');
    const d = await api(url);
    renderRelatorio(d, n);
  } catch (e) { alert(e.message); }
}

function renderRelatorio(d, n) {
  $('rel-meta').textContent = fmtQtd(d.totalMeta) + ' fardos';
  $('rel-atingido').textContent = fmtQtd(d.totalAtingido) + ' fardos';
  $('rel-pct').textContent = fmtPct(d.pctGeral);

  const mensal = n === 1;
  const labels = mensal
    ? d.porVendedor.map((v) => v.nome)
    : d.meses.map((m) => m.nomeMes);
  const metas = mensal
    ? d.porVendedor.map((v) => v.valores[0] ? v.valores[0].meta : 0)
    : d.meses.map((m) => m.meta);
  const vendidos = mensal
    ? d.porVendedor.map((v) => v.valores[0] ? v.valores[0].atingido : 0)
    : d.meses.map((m) => m.atingido);

  novoGrafico('grafico-meta', {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Meta', data: metas, backgroundColor: 'rgba(148,163,184,.55)' },
        { label: 'Vendido', data: vendidos, backgroundColor: '#16a34a' }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } }
    }
  });

  if (!mensal) {
    novoGrafico('grafico-pct', {
      type: 'line',
      data: {
        labels: d.meses.map((m) => m.nomeMes),
        datasets: [{ label: '% atingido', data: d.meses.map((m) => m.pct), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.12)', fill: true, tension: .3 }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, max: 150 } },
        plugins: { legend: { display: false } }
      }
    });
  } else {
    destruirGrafico('grafico-pct');
  }

  if (!mensal && !$('filtro-vendedor').value) {
    novoGrafico('grafico-comp', {
      type: 'line',
      data: {
        labels: d.meses.map((m) => m.nomeMes),
        datasets: d.porVendedor.map((v, i) => ({
          label: v.nome,
          data: v.valores.map((x) => x.atingido),
          borderColor: 'hsl(' + (i * 47) + ',70%,45%)',
          backgroundColor: 'transparent',
          tension: .3
        }))
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { position: 'bottom' } }
      }
    });
  } else {
    destruirGrafico('grafico-comp');
  }

  let linhas;
  if (mensal) {
    linhas = '<tr><th>Vendedor</th><th>Meta</th><th>Vendido</th><th>%</th></tr>';
    d.porVendedor.forEach(function (v) {
      const x = v.valores[0] || { meta: 0, atingido: 0 };
      linhas += '<tr><td>' + v.nome + '</td><td>' + fmtQtd(x.meta) + '</td><td>' + fmtQtd(x.atingido) + '</td><td class="tend">' + fmtPct(x.meta > 0 ? (x.atingido / x.meta) * 100 : 0) + '</td></tr>';
    });
  } else {
    linhas = '<tr><th>Mês</th><th>Meta</th><th>Vendido</th><th>%</th><th>D.U.</th></tr>';
    d.meses.forEach(function (m) {
      linhas += '<tr><td>' + m.nomeMes + '</td><td>' + fmtQtd(m.meta) + '</td><td>' + fmtQtd(m.atingido) + '</td><td class="tend">' + fmtPct(m.pct) + '</td><td>' + m.utMes + '</td></tr>';
    });
  }
  $('tabela-relatorio').innerHTML = linhas;
}

function preencherFiltroVendedor() {
  api('/api/supervisor/usuarios')
    .then(function (lista) {
      const opcoes = lista.filter((u) => u.perfil !== 'supervisor')
        .map((u) => '<option value="' + u.id + '">' + u.nome + '</option>')
        .join('');
      $('filtro-vendedor').innerHTML = '<option value="">Todos os vendedores</option>' + opcoes;
    })
    .catch(function () {});
}

$('btn-mu-cancelar').addEventListener('click', fecharModalUsuario);
$('btn-mu-salvar').addEventListener('click', salvarModalUsuario);
window.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { fecharModalUsuario(); fecharModalSenha(); }
});

function abrirModalSenha() {
  $('ms-atual').value = '';
  $('ms-nova').value = '';
  $('ms-erro').classList.add('hidden');
  $('modal-senha').classList.remove('hidden');
  $('ms-atual').focus();
}
function fecharModalSenha() {
  $('modal-senha').classList.add('hidden');
}
async function salvarModalSenha() {
  try {
    await api('/api/auth/trocar-senha', {
      method: 'POST',
      body: {
        senhaAtual: $('ms-atual').value,
        novaSenha: $('ms-nova').value
      }
    });
    fecharModalSenha();
    alert('Senha alterada com sucesso!');
  } catch (e) {
    $('ms-erro').textContent = e.message;
    $('ms-erro').classList.remove('hidden');
  }
}
$('btn-trocar-senha').addEventListener('click', abrirModalSenha);
$('btn-ms-cancelar').addEventListener('click', fecharModalSenha);
$('btn-ms-salvar').addEventListener('click', salvarModalSenha);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
