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


function init() {
  const temas = ['azul', 'vermelho', 'verde', 'roxo', 'amarelo'];
  const temaSalvo = localStorage.getItem('tema') || 'azul';
  document.documentElement.setAttribute('data-tema', temaSalvo);
  $('btn-tema').addEventListener('click', function () {
    const atual = document.documentElement.getAttribute('data-tema') || 'azul';
    const idx = (temas.indexOf(atual) + 1) % temas.length;
    const novo = temas[idx];
    document.documentElement.setAttribute('data-tema', novo);
    localStorage.setItem('tema', novo);
  });

  $('btn-sair').addEventListener('click', sairSistema);
  $('perfil-badge').addEventListener('click', abrirModalNome);
  api('/api/auth/me')
    .then(function (me) {
      MEU_USUARIO = me;
      $('saudacao').innerHTML = '<b>' + me.nome + '</b>' + (me.setor ? ' - ' + me.setor : '');
      if (me.perfil === 'vendedor') {
        iniciarVendedor();
      } else {
        iniciarSupervisor();
      }
    })
    .catch(function () { window.location.href = '/login.html'; });
}

function abrirModalNome() {
  $('inp-nome').value = MEU_USUARIO.nome;
  $('nome-erro').classList.add('hidden');
  $('modal-nome').classList.remove('hidden');
  $('inp-nome').focus();
  $('inp-nome').select();
}

function fecharModalNome() {
  $('modal-nome').classList.add('hidden');
}

async function salvarModalNome() {
  const nome = $('inp-nome').value.trim();
  if (!nome) {
    $('nome-erro').textContent = 'Informe seu nome.';
    $('nome-erro').classList.remove('hidden');
    return;
  }
  try {
    MEU_USUARIO = await api('/api/me/nome', { method: 'POST', body: { nome } });
    $('saudacao').innerHTML = '<b>' + MEU_USUARIO.nome + '</b>' + (MEU_USUARIO.setor ? ' - ' + MEU_USUARIO.setor : '');
    fecharModalNome();
  } catch (e) { alert(e.message); }
}

let MODO_MES = 'incluir';
let ANO_MES_EDITANDO = null;

function abrirModalMes() {
  MODO_MES = 'incluir';
  ANO_MES_EDITANDO = null;
  $('mm-titulo').textContent = 'Incluir mês passado';
  $('mm-anoMes').value = '';
  $('mm-anoMes').readOnly = false;
  $('mm-meta').value = '';
  $('mm-total').value = '';
  $('mm-erro').classList.add('hidden');
  $('modal-mes').classList.remove('hidden');
  $('mm-anoMes').focus();
}

function abrirModalMesEditar(h) {
  MODO_MES = 'editar';
  ANO_MES_EDITANDO = h.anoMes;
  $('mm-titulo').textContent = 'Editar ' + h.nomeMes;
  $('mm-anoMes').value = h.anoMes;
  $('mm-anoMes').readOnly = true;
  $('mm-meta').value = h.meta || '';
  $('mm-total').value = h.atingido || '';
  $('mm-erro').classList.add('hidden');
  $('modal-mes').classList.remove('hidden');
  $('mm-meta').focus();
}

function fecharModalMes() {
  $('modal-mes').classList.add('hidden');
}

async function salvarModalMes() {
  const anoMes = MODO_MES === 'editar' ? ANO_MES_EDITANDO : $('mm-anoMes').value;
  const meta = numFromInput($('mm-meta').value);
  const total = numFromInput($('mm-total').value);
  if (MODO_MES !== 'editar' && (!anoMes || !/^\d{4}-\d{2}$/.test(anoMes))) {
    $('mm-erro').textContent = 'Informe o mês no formato AAAA-MM.';
    $('mm-erro').classList.remove('hidden');
    return;
  }
  if (meta === null || meta < 0) {
    $('mm-erro').textContent = 'Informe uma meta válida.';
    $('mm-erro').classList.remove('hidden');
    return;
  }
  if (total === null || total < 0) {
    $('mm-erro').textContent = 'Informe um total válido.';
    $('mm-erro').classList.remove('hidden');
    return;
  }
  try {
    if (MODO_MES === 'editar') {
      const d = await api('/api/me/historico/' + ANO_MES_EDITANDO, { method: 'PUT', body: { meta, total } });
      if (estaNoSupervisor()) renderSupervisorPessoal(d);
      else renderVendedor(d);
    } else {
      const d = await api('/api/me/incluir-mes', { method: 'POST', body: { anoMes, meta, total } });
      if (estaNoSupervisor()) renderSupervisorPessoal(d);
      else renderVendedor(d);
    }
    fecharModalMes();
  } catch (e) { alert(e.message); }
}

async function excluirMesHistorico(h) {
  if (!confirm('Excluir os dados de ' + h.nomeMes + '? Essa ação não pode ser desfeita.')) return;
  try {
    const d = await api('/api/me/historico/' + h.anoMes, { method: 'DELETE' });
    if (estaNoSupervisor()) renderSupervisorPessoal(d);
    else renderVendedor(d);
  } catch (e) { alert(e.message); }
}

/* ============================= VENDEDOR ============================= */

function iniciarVendedor() {
  $('view-vendedor').classList.remove('hidden');
  $('data-hoje').textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  $('btn-lancar-card').addEventListener('click', function () { abrirModalValor('lancar'); });
  $('btn-meta-card').addEventListener('click', function () { abrirModalValor('meta'); });
  $('btn-iniciar-mes').addEventListener('click', iniciarMesAtual);
  $('btn-fechar-mes').addEventListener('click', fecharMes);
  $('btn-incluir-mes').addEventListener('click', abrirModalMes);
  $('btn-print').addEventListener('click', ativarModoPrint);
  $('btn-print-fechar').addEventListener('click', desativarModoPrint);
  $('btn-print-limpo').addEventListener('click', ativarPrintLimpo);
  $('btn-print-limpo-fechar').addEventListener('click', desativarPrintLimpo);
  $('btn-v-relatorios').addEventListener('click', function () {
    $('view-vendedor').classList.add('hidden');
    $('view-v-relatorios').classList.remove('hidden');
    $('v-rel-data').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (!$('v-rel-ano')._populado) popularAnosRelatorio();
  });
  $('btn-v-rel-fechar').addEventListener('click', function () {
    $('view-v-relatorios').classList.add('hidden');
    $('view-vendedor').classList.remove('hidden');
  });
  $('btn-v-rel-gerar').addEventListener('click', gerarRelatorioVendedor);
  $('v-rel-ano').addEventListener('change', function () {
    const temAno = !!$('v-rel-ano').value;
    if (!temAno) {
      $('v-rel-periodo').value = 'ano';
      $('v-rel-periodo').disabled = true;
    } else {
      $('v-rel-periodo').disabled = false;
    }
  });
  carregarPainelVendedor();
}

function ativarModoPrint() {
  document.body.classList.add('print-ativo');
  $('print-overlay').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function desativarModoPrint() {
  document.body.classList.remove('print-ativo');
  $('print-overlay').classList.add('hidden');
}

let plDados = null;
function ativarPrintLimpo() {
  api('/api/me/dashboard').then(function (d) {
    plDados = d;
    $('pl-saudacao').textContent = $('saudacao').textContent;
    $('pl-data').textContent = $('data-hoje').textContent;
    const c = d.calc;
    const temTend = c.trab > 0 && d.meta > 0;
    $('pl-tend-valor').textContent = temTend ? fmtPct(c.tendencia) : '—';
    $('pl-tend-barra').style.width = (temTend ? Math.min(100, c.tendencia) : 0) + '%';
    const temMetDia = c.rest > 0 && d.meta > 0;
    $('pl-metadia-valor').textContent = temMetDia ? fmtQtd(c.metaDiaria) + ' fardos' : '—';
    $('print-limpo-view').classList.remove('hidden');
    window.scrollTo({ top: 0 });
  });
}
function desativarPrintLimpo() {
  $('print-limpo-view').classList.add('hidden');
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
  if ($('nome-mes')) $('nome-mes').textContent = d.nomeMes;
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
  const faltanteTend = d.meta - c.projetado;
  $('tend-proj').textContent = temTend
    ? 'Projeção de fechamento: ' + fmtQtd(c.projetado) + (faltanteTend > 0 ? ' (-' + fmtQtd(faltanteTend) + ')' : '')
    : (c.trab === 0 ? 'Ainda sem dias úteis trabalhados neste mês.' : 'Defina a meta do mês para calcular.');
  $('tend-media').textContent = temTend
    ? 'Média Diária ' + fmtQtd(c.media) + ' × ' + c.utMes + ' dias = ' + fmtQtd(c.projetado)
    : '';
  $('tend-formula').textContent = temTend
    ? 'Tendência = (' + fmtQtd(d.total) + ' ÷ ' + c.trab + ') × ' + c.utMes + ' ÷ ' + fmtQtd(d.meta) + ' × 100 = ' + fmtPct(c.tendencia)
    : '';

  const temMetDia = c.rest > 0 && d.meta > 0;
  $('metadia-valor').textContent = temMetDia ? fmtQtd(c.metaDiaria) + ' fardos' : '—';
  $('metadia-info').textContent = temMetDia
    ? (d.meta - d.total > 0 ? fmtQtd(d.meta - d.total) + ' faltantes ÷ ' + c.rest + ' dias úteis' : 'Meta já atingida no mês.')
    : (d.meta > 0 ? 'Não há dias úteis restantes no mês.' : 'Defina a meta do mês para calcular.');
  $('metadia-formula').textContent = temMetDia
    ? 'Meta diária = (' + fmtQtd(d.meta) + ' − ' + fmtQtd(d.total) + ') ÷ ' + c.rest + ' = ' + fmtQtd(c.metaDiaria) + ' fardos'
    : '';

  $('atualizado').textContent = d.atualizadoEm
    ? new Date(d.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Ainda não lançado neste mês';

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

function montarTabelaHistorico(hist, prefixo, comAcoes) {
  const total = hist.length;
  const visiveis = 3;
  let linhas = '<tr><th>Mês</th><th>Meta</th><th>Atingido</th><th>%</th><th>D.U.</th>';
  if (comAcoes) linhas += '<th></th>';
  linhas += '</tr>';
  hist.forEach(function (h, i) {
    const escondido = total > visiveis && i >= visiveis;
    const trAcao = comAcoes
      ? '<td class="hist-acoes"><button class="btn-icon" data-' + prefixo + 'edita-mes="' + h.anoMes + '" title="Editar mês">✎</button> <button class="btn-icon perigo" data-' + prefixo + 'deleta-mes="' + h.anoMes + '" title="Excluir mês">✕</button></td>'
      : '';
    linhas += '<tr class="hist-row' + (escondido ? ' hist-oculto' : '') + '"><td>' + h.nomeMes + '</td><td>' + fmtQtd(h.meta) + '</td><td>' + fmtQtd(h.atingido) + '</td><td class="tend">' + fmtPct(h.pct) + '</td><td>' + h.utMes + '</td>' + trAcao + '</tr>';
  });
  if (total > visiveis) {
    const colspan = comAcoes ? 6 : 5;
    linhas += '<tr id="hist-expandir-' + prefixo + '" class="hist-expandir"><td colspan="' + colspan + '" style="text-align:center"><button class="btn-link" id="btn-hist-expandir-' + prefixo + '">▼ Mais</button></td></tr>';
  }
  return linhas;
}

function bindExpandirHistorico(tabela, prefixo) {
  const btnExp = document.getElementById('btn-hist-expandir-' + prefixo);
  if (!btnExp) return;
  btnExp.addEventListener('click', function () {
    const ocultos = tabela.querySelectorAll('.hist-oculto');
    if (ocultos.length) {
      ocultos.forEach(function (r) { r.classList.remove('hist-oculto'); });
      btnExp.textContent = '▲ Menos';
    } else {
      const rows = tabela.querySelectorAll('.hist-row');
      rows.forEach(function (r, i) { if (i >= 3) r.classList.add('hist-oculto'); });
      btnExp.textContent = '▼ Mais';
    }
  });
}

function renderHistorico(hist) {
  const tabela = $('tabela-historico');
  if (!hist.length) {
    tabela.innerHTML = '<tr><td class="vazio">Nenhum mês finalizado ainda.</td></tr>';
    destruirGrafico('grafico-historico');
    return;
  }
  tabela.innerHTML = montarTabelaHistorico(hist, '', true);
  bindExpandirHistorico(tabela, '');

  tabela.querySelectorAll('[data-edita-mes]').forEach(function (b) {
    b.addEventListener('click', function () {
      const h = hist.find((x) => x.anoMes === b.dataset.editaMes);
      if (h) abrirModalMesEditar(h);
    });
  });
  tabela.querySelectorAll('[data-deleta-mes]').forEach(function (b) {
    b.addEventListener('click', function () {
      const h = hist.find((x) => x.anoMes === b.dataset.deletaMes);
      if (h) excluirMesHistorico(h);
    });
  });

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

function estaNoSupervisor() {
  return !$('view-supervisor').classList.contains('hidden');
}

function recarregarPainelAtual() {
  if (estaNoSupervisor()) carregarGeral();
  else carregarPainelVendedor();
}

let MODO_VALOR = null;

function abrirModalValor(modo) {
  MODO_VALOR = modo;
  const ehMeta = modo === 'meta';
  $('valor-titulo').textContent = ehMeta ? 'Meta do mês' : 'Lançar vendas do mês';
  $('valor-dica').textContent = ehMeta
    ? 'Total de fardos a atingir no mês.'
    : 'Total acumulado vendido até hoje (fardos).';
  $('inp-valor').value = '';
  $('valor-erro').classList.add('hidden');
  $('modal-valor').classList.remove('hidden');
  $('inp-valor').focus();
}

function fecharModalValor() {
  $('modal-valor').classList.add('hidden');
}

async function salvarModalValor() {
  const valor = numFromInput($('inp-valor').value);
  if (valor === null || valor < 0) {
    $('valor-erro').textContent = 'Informe um valor válido.';
    $('valor-erro').classList.remove('hidden');
    return;
  }
  try {
    if (MODO_VALOR === 'meta') {
      const d = await api('/api/me/meta', { method: 'POST', body: { meta: valor } });
      if (estaNoSupervisor()) renderSupervisorPessoal(d);
      else renderVendedor(d);
    } else {
      const d = await api('/api/me/lancar', { method: 'POST', body: { total: valor } });
      if (estaNoSupervisor()) renderSupervisorPessoal(d);
      else renderVendedor(d);
    }
    fecharModalValor();
  } catch (e) { alert(e.message); }
}

async function iniciarMesAtual() {
  try {
    const d = await api('/api/me/iniciar-mes', { method: 'POST' });
    if (estaNoSupervisor()) renderSupervisorPessoal(d);
    else renderVendedor(d);
  } catch (e) { alert(e.message); }
}

async function fecharMes() {
  if (!confirm('Fechar o mês atual? Ele vai para o histórico e o próximo mês será aberto.')) return;
  try {
    const r = await api('/api/me/fechar-mes', { method: 'POST' });
    alert(r.fechado.nomeMes + ' foi fechado e salvo no histórico.');
    if (estaNoSupervisor()) carregarGeral();
    else renderVendedor(r.dashboard);
  } catch (e) { alert(e.message); }
}

/* ============================= SUPERVISOR ============================= */

function iniciarSupervisor() {
  const ehSuporte = MEU_USUARIO.perfil === 'suporte';
  $('tab-vendedores-nome').textContent = ehSuporte ? 'Usuários' : 'Vendedores';
  $('btn-novo-vendedor').textContent = ehSuporte ? '+ Novo usuário' : '+ Novo vendedor';
  $('tab-vendedores').classList.toggle('hidden', !ehSuporte);
  $('view-supervisor').classList.remove('hidden');
  if (ehSuporte) {
    $('tab-vendedores').classList.add('ativa');
    document.querySelector('[data-tab="geral"]').classList.remove('ativa');
    $('aba-vendedores').classList.remove('hidden');
    $('aba-geral').classList.add('hidden');
    carregarVendedores();
  }
  $('data-hoje').textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
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
  $('btn-sup-rel-gerar').addEventListener('click', carregarRelatorioSupervisor);
  $('sp-btn-meta').addEventListener('click', function () { abrirModalValor('meta'); });
  $('sp-btn-lancar').addEventListener('click', function () { abrirModalValor('lancar'); });
  $('sp-btn-iniciar-mes').addEventListener('click', iniciarMesAtual);
  $('sp-btn-fechar-mes').addEventListener('click', fecharMes);
  $('sp-btn-print').addEventListener('click', ativarModoPrintSupervisor);
  $('sp-btn-print-fechar').addEventListener('click', desativarModoPrintSupervisor);
  $('sp-btn-print-limpo').addEventListener('click', ativarPrintLimpoSupervisor);
  $('sp-btn-print-limpo-fechar').addEventListener('click', desativarPrintLimpoSupervisor);
  $('sp-btn-incluir-mes').addEventListener('click', function () {
    MODO_MES = 'incluir';
    ANO_MES_EDITANDO = null;
    $('mm-titulo').textContent = 'Incluir mês passado';
    $('mm-anoMes').value = '';
    $('mm-anoMes').readOnly = false;
    $('mm-meta').value = '';
    $('mm-total').value = '';
    $('mm-erro').classList.add('hidden');
    $('modal-mes').classList.remove('hidden');
    $('mm-anoMes').focus();
  });
  popularFiltrosRelatorioSupervisor();
  carregarGeral();
}

async function carregarGeral() {
  try {
    const [d, equipe] = await Promise.all([
      api('/api/me/dashboard'),
      api('/api/supervisor/dashboard')
    ]);
    renderSupervisorPessoal(d);
    renderSupervisorEquipe(equipe);
    renderDiferencasEquipe(d, equipe);
  } catch (e) { alert(e.message); }
}

function renderDiferencasEquipe(pessoal, equipe) {
  const pares = [
    { el: 'sup-meta', ref: pessoal.meta || 0, val: equipe.totalMeta || 0 },
    { el: 'sup-atingido', ref: pessoal.total || 0, val: equipe.totalAtingido || 0 }
  ];
  pares.forEach(function (x) {
    const dif = x.val - x.ref;
    const base = fmtQtd(x.val) + ' fardos';
    const el = $(x.el);
    if (!dif) { el.textContent = base; return; }
    const sinal = dif > 0 ? '+' : '−';
    const cor = dif < 0 ? '#ef4444' : '#16a34a';
    el.innerHTML = base + ' <span style="color:' + cor + '; font-weight:700;">(' + sinal + fmtQtd(Math.abs(dif)) + ')</span>';
  });
}

let spPlDados = null;
function ativarModoPrintSupervisor() {
  document.body.classList.add('sp-print-ativo');
  $('sp-print-overlay').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function desativarModoPrintSupervisor() {
  document.body.classList.remove('sp-print-ativo');
  $('sp-print-overlay').classList.add('hidden');
}
function ativarPrintLimpoSupervisor() {
  api('/api/me/dashboard').then(function (d) {
    spPlDados = d;
    $('sp-pl-saudacao').textContent = $('saudacao').textContent;
    $('sp-pl-data').textContent = $('data-hoje').textContent;
    const c = d.calc;
    const temTend = c.trab > 0 && d.meta > 0;
    $('sp-pl-tend-valor').textContent = temTend ? fmtPct(c.tendencia) : '—';
    $('sp-pl-tend-barra').style.width = (temTend ? Math.min(100, c.tendencia) : 0) + '%';
    const temMetDia = c.rest > 0 && d.meta > 0;
    $('sp-pl-metadia-valor').textContent = temMetDia ? fmtQtd(c.metaDiaria) + ' fardos' : '—';
    $('sp-print-limpo-view').classList.remove('hidden');
    window.scrollTo({ top: 0 });
  });
}
function desativarPrintLimpoSupervisor() {
  $('sp-print-limpo-view').classList.add('hidden');
}

function renderSupervisorPessoal(d) {
  const c = d.calc;
  if (MEU_USUARIO.perfil === 'suporte') {
    ['sp-btn-meta', 'sp-btn-lancar', 'sp-btn-iniciar-mes', 'sp-btn-incluir-mes', 'sp-btn-fechar-mes'].forEach(function (id) {
      const b = $(id);
      if (b) b.classList.add('hidden');
    });
  }
  $('sp-chip-mes').textContent = c.utMes;
  $('sp-chip-trab').textContent = c.trab;
  $('sp-chip-rest').textContent = c.rest;
  $('sp-meta-valor').textContent = d.meta ? fmtQtd(d.meta) + ' fardos' : '—';
  $('sp-total-valor').textContent = fmtQtd(d.total) + ' fardos';

  const alcPct = Math.min(100, c.atingidoPct);
  $('sp-barra-alc').style.width = alcPct + '%';
  const faltante = d.meta - d.total;
  $('sp-alc-info').textContent = d.meta > 0
    ? (faltante > 0 ? fmtPct(c.atingidoPct) + ' da meta · faltam ' + fmtQtd(faltante) + ' fardos' : 'Meta batida!')
    : 'Defina a meta do mês para acompanhar.';

  const temTend = c.trab > 0 && d.meta > 0;
  $('sp-tend-valor').textContent = temTend ? fmtPct(c.tendencia) : '—';
  $('sp-barra-tend').style.width = (temTend ? Math.min(100, c.tendencia) : 0) + '%';
  const faltanteTend = d.meta - c.projetado;
  $('sp-tend-proj').textContent = temTend
    ? 'Projeção de fechamento: ' + fmtQtd(c.projetado) + (faltanteTend > 0 ? ' (-' + fmtQtd(faltanteTend) + ')' : '')
    : (c.trab === 0 ? 'Ainda sem dias úteis trabalhados neste mês.' : 'Defina a meta do mês para calcular.');
  $('sp-tend-media').textContent = temTend
    ? 'Média Diária ' + fmtQtd(c.media) + ' × ' + c.utMes + ' dias = ' + fmtQtd(c.projetado)
    : '';
  $('sp-tend-formula').textContent = temTend
    ? 'Tendência = (' + fmtQtd(d.total) + ' ÷ ' + c.trab + ') × ' + c.utMes + ' ÷ ' + fmtQtd(d.meta) + ' × 100 = ' + fmtPct(c.tendencia)
    : '';

  const temMetDia = c.rest > 0 && d.meta > 0;
  $('sp-metadia-valor').textContent = temMetDia ? fmtQtd(c.metaDiaria) + ' fardos' : '—';
  $('sp-metadia-info').textContent = temMetDia
    ? (d.meta - d.total > 0 ? fmtQtd(d.meta - d.total) + ' faltantes ÷ ' + c.rest + ' dias úteis' : 'Meta já atingida no mês.')
    : (d.meta > 0 ? 'Não há dias úteis restantes no mês.' : 'Defina a meta do mês para calcular.');
  $('sp-metadia-formula').textContent = temMetDia
    ? 'Meta diária = (' + fmtQtd(d.meta) + ' − ' + fmtQtd(d.total) + ') ÷ ' + c.rest + ' = ' + fmtQtd(c.metaDiaria) + ' fardos'
    : '';

  $('sp-atualizado').textContent = d.atualizadoEm
    ? new Date(d.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Ainda não lançado neste mês';

  const aviso = $('sup-aviso-fechado');
  if (d.fechado) {
    aviso.textContent = 'Este mês está fechado. Abra o próximo mês ou lance no mês seguinte.';
    aviso.classList.remove('hidden');
  } else {
    aviso.classList.add('hidden');
  }

  $('sp-btn-iniciar-mes').classList.toggle('hidden', !(d.mes < hojeKey()));
  $('sp-btn-fechar-mes').disabled = !!d.fechado;
  $('sp-btn-fechar-mes').textContent = d.fechado ? 'Mês fechado' : 'Fechar mês';

  renderSupervisorHistorico(d.historico);
}

function renderSupervisorHistorico(hist) {
  const tabela = $('sp-tabela-historico');
  if (!hist.length) {
    tabela.innerHTML = '<tr><td class="vazio">Nenhum mês finalizado ainda.</td></tr>';
    destruirGrafico('sp-grafico-historico');
    return;
  }
  tabela.innerHTML = montarTabelaHistorico(hist, 'sp-', true);
  bindExpandirHistorico(tabela, 'sp-');

  tabela.querySelectorAll('[data-sp-edita-mes]').forEach(function (b) {
    b.addEventListener('click', function () {
      const h = hist.find((x) => x.anoMes === b.dataset.spEditaMes);
      if (h) abrirModalMesEditar(h);
    });
  });
  tabela.querySelectorAll('[data-sp-deleta-mes]').forEach(function (b) {
    b.addEventListener('click', function () {
      const h = hist.find((x) => x.anoMes === b.dataset.spDeletaMes);
      if (h) excluirMesHistorico(h);
    });
  });

  const labels = hist.map((h) => h.nomeMes);
  novoGrafico('sp-grafico-historico', {
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

function renderSupervisorEquipe(d) {
  $('sup-nome-mes2').textContent = d.nomeMes;
  $('sup-meta').textContent = d.totalMeta ? fmtQtd(d.totalMeta) + ' fardos' : '—';
  $('sup-atingido').textContent = fmtQtd(d.totalAtingido) + ' fardos';
  $('sup-pct').textContent = d.pctGeral ? fmtPct(d.pctGeral) : '—';

  let linhas = '<tr><th>Setor</th><th>Nome</th><th>Meta</th><th>Realizado</th><th>Vendas%</th><th>Tend.%</th><th>M. Diária</th></tr>';
  d.linhas.sort(function (a, b) {
    const sa = (a.setor || '').localeCompare(b.setor || '', undefined, { numeric: true });
    return sa !== 0 ? sa : (a.nome || '').localeCompare(b.nome || '');
  }).forEach(function (l) {
    const linha = '<tr><td>' + esc(l.setor || '—') + '</td><td>' + esc(l.nome) + '</td><td>' + fmtQtd(l.meta) + '</td><td>' + fmtQtd(l.atingido) + '</td><td class="tend">' + fmtPct(l.calc.atingidoPct) + '</td><td class="tend">' + (l.calc.tendencia > 0 ? fmtPct(l.calc.tendencia) : '—') + '</td><td>' + (l.calc.metaDiaria > 0 ? fmtQtd(l.calc.metaDiaria) : '—') + '</td></tr>';
    linhas += linha;
  });
  $('tabela-geral').innerHTML = linhas || '<tr><td class="vazio">Nenhum vendedor cadastrado.</td></tr>';

}

async function carregarVendedores() {
  try {
    const lista = await api('/api/supervisor/usuarios');
    const vendedores = lista.sort(function (a, b) {
      const sa = (a.setor || '').localeCompare(b.setor || '', undefined, { numeric: true });
      return sa !== 0 ? sa : (a.nome || '').localeCompare(b.nome || '');
    });
    let linhas = '<tr><th>Setor</th><th>Nome</th><th>Situação</th><th></th></tr>';
    vendedores.forEach(function (u) {
      linhas += '<tr><td>' + esc(u.setor || '—') + '</td><td>' + esc(u.nome) + '</td><td>' + (u.ativo ? 'Ativo' : 'Inativo') + '</td><td>'
        + '<button class="btn fino" data-painel="' + u.id + '">Painel</button> '
        + '<button class="btn fino" data-edita="' + u.id + '">Editar</button>'
        + '</td></tr>';
    });
    $('tabela-vendedores').innerHTML = linhas || '<tr><td class="vazio">Nenhum usuário cadastrado.</td></tr>';

    document.querySelectorAll('[data-painel]').forEach(function (b) {
      b.addEventListener('click', function () {
        const u = vendedores.find((x) => x.id === b.dataset.painel);
        abrirPainelUsuario(u);
      });
    });
    document.querySelectorAll('[data-edita]').forEach(function (b) {
      b.addEventListener('click', function () {
        const u = vendedores.find((x) => x.id === b.dataset.edita);
        abrirModalUsuario(u);
      });
    });
  } catch (e) { alert(e.message); }
}

async function abrirPainelUsuario(u) {
  try {
    const d = await api('/api/supervisor/usuarios/' + u.id + '/painel');
    renderPainel(d);
    $('modal-painel').classList.remove('hidden');
  } catch (e) { alert(e.message); }
}

function fecharModalPainel() {
  $('modal-painel').classList.add('hidden');
}

function renderPainel(d) {
  const c = d.calc;
  $('mp-titulo').textContent = d.nome + (d.setor ? ' (' + d.setor + ')' : '');
  $('mp-nome-mes').textContent = d.nomeMes;
  $('mp-meta').textContent = d.meta ? fmtQtd(d.meta) + ' fardos' : '—';
  $('mp-total').textContent = fmtQtd(d.total) + ' fardos';
  $('mp-chip-mes').textContent = c.utMes;
  $('mp-chip-trab').textContent = c.trab;
  $('mp-chip-rest').textContent = c.rest;
  $('mp-atualizado').textContent = d.atualizadoEm
    ? 'Atualizado: ' + new Date(d.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Ainda não lançado neste mês';

  const alcPct = Math.min(100, c.atingidoPct);
  $('mp-barra-alc').style.width = alcPct + '%';
  const faltante = d.meta - d.total;
  $('mp-alc-info').textContent = d.meta > 0
    ? (faltante > 0 ? fmtPct(c.atingidoPct) + ' da meta · faltam ' + fmtQtd(faltante) + ' fardos' : 'Meta batida!')
    : 'Meta não definida.';

  const temTend = c.trab > 0 && d.meta > 0;
  $('mp-tend').textContent = temTend ? fmtPct(c.tendencia) : '—';
  $('mp-barra-tend').style.width = (temTend ? Math.min(100, c.tendencia) : 0) + '%';
  $('mp-tend-info').textContent = temTend
    ? 'Média ' + fmtQtd(c.media) + ' fardos/dia × ' + c.utMes + ' dias úteis = ' + fmtQtd(c.projetado) + ' fardos'
    : (c.trab === 0 ? 'Ainda sem dias úteis trabalhados neste mês.' : 'Defina a meta do mês para calcular.');

  const temMetDia = c.rest > 0 && d.meta > 0;
  $('mp-metadia').textContent = temMetDia ? fmtQtd(c.metaDiaria) + ' fardos' : '—';
  $('mp-metadia-info').textContent = temMetDia
    ? (d.meta - d.total > 0 ? fmtQtd(d.meta - d.total) + ' faltantes ÷ ' + c.rest + ' dias úteis' : 'Meta já atingida no mês.')
    : (d.meta > 0 ? 'Não há dias úteis restantes no mês.' : 'Defina a meta do mês para calcular.');

  const tabela = $('tabela-painel-hist');
  if (!d.historico.length) {
    tabela.innerHTML = '<tr><td class="vazio">Nenhum mês finalizado ainda.</td></tr>';
    destruirGrafico('grafico-painel-hist');
    return;
  }
  tabela.innerHTML = montarTabelaHistorico(d.historico, 'mp-', false);
  bindExpandirHistorico(tabela, 'mp-');

  novoGrafico('grafico-painel-hist', {
    type: 'bar',
    data: {
      labels: d.historico.map((h) => h.nomeMes),
      datasets: [
        { label: 'Meta', data: d.historico.map((h) => h.meta), backgroundColor: 'rgba(148,163,184,.55)' },
        { label: 'Vendido', data: d.historico.map((h) => h.atingido), backgroundColor: '#16a34a' }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

async function resetarSenhaUsuario(u) {
  if (!confirm('Gerar uma senha nova provisória para ' + u.nome + '?')) return;
  try {
    const r = await api('/api/supervisor/usuarios/' + u.id + '/resetar-senha', { method: 'POST' });
    alert('Senha de ' + u.nome + ' resetada para: ' + r.senha + '\nAnote e avise — ela pode trocar depois pelo botão "Trocar senha".');
  } catch (e) { alert(e.message); }
}

async function excluirUsuario() {
  if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;
  try {
    await api('/api/supervisor/usuarios/' + ID_USUARIO, { method: 'DELETE' });
    fecharModalUsuario();
    carregarVendedores();
  } catch (e) {
    $('mu-erro').textContent = e.message;
    $('mu-erro').classList.remove('hidden');
  }
}

let MODO_USUARIO = 'novo';
let ID_USUARIO = null;

function resetarSenhaModal() {
  if (!ID_USUARIO) return;
  resetarSenhaUsuario({ id: ID_USUARIO, nome: $('mu-nome').value });
}

function abrirModalUsuario(u) {
  MODO_USUARIO = u ? 'editar' : 'novo';
  ID_USUARIO = u ? u.id : null;
  const ehSuporte = MEU_USUARIO.perfil === 'suporte';
  $('modal-usuario-titulo').textContent = u
    ? (ehSuporte ? 'Editar usuário' : 'Editar vendedor')
    : (ehSuporte ? 'Novo usuário' : 'Novo vendedor');
  $('mu-nome').value = u ? u.nome : '';
  $('mu-setor').value = u ? u.setor : '';
  $('mu-email').value = u ? u.email : '';
  $('mu-perfil-linha').style.display = ehSuporte ? '' : 'none';
  $('mu-perfil').value = u ? u.perfil : 'vendedor';
  $('mu-ativo').checked = u ? u.ativo : true;
  $('mu-senha').value = '';
  $('mu-erro').classList.add('hidden');
  $('mu-advanced').classList.toggle('hidden', !u);
  $('mu-senha-linha').style.display = u ? 'none' : '';
  $('modal-usuario').classList.remove('hidden');
}

function fecharModalUsuario() {
  $('modal-usuario').classList.add('hidden');
}

async function salvarModalUsuario() {
  const ehSuporte = MEU_USUARIO.perfil === 'suporte';
  const corpo = {
    nome: $('mu-nome').value.trim(),
    setor: $('mu-setor').value.trim(),
    email: $('mu-email').value.trim(),
    perfil: ehSuporte ? $('mu-perfil').value : 'vendedor'
  };
  const senha = $('mu-senha').value;
  if (senha) corpo.senha = senha;
  if (MODO_USUARIO === 'novo' || MODO_USUARIO === 'editar') corpo.ativo = $('mu-ativo').checked;
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

/* ============================= RELATÓRIO DO VENDEDOR ============================= */

function popularAnosRelatorio() {
  return api('/api/me/relatorios').then(function (d) {
    const anos = [...new Set(d.dados.map(function (x) { return x.anoMes.substring(0, 4); }))].sort().reverse();
    $('v-rel-ano').innerHTML = '<option value="">Ano</option>' + '<option value="">Todos</option>' + anos.map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join('');
    $('v-rel-ano')._populado = true;
  });
}

async function gerarRelatorioVendedor() {
  try {
    const periodo = $('v-rel-periodo').value;
    const anoSel = $('v-rel-ano').value;
    if (!periodo) return;

    const d = await api('/api/me/relatorios');
    let dados = d.dados;
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    if (periodo === 'anterior') {
      let a = anoSel ? Number(anoSel) : anoAtual;
      let m = mesAtual - 1;
      if (m < 1) { m = 12; a--; }
      const chave = a + '-' + String(m).padStart(2, '0');
      dados = dados.filter(function (x) { return x.anoMes === chave; });
    } else if (periodo === 'ano') {
      if (anoSel) {
        dados = dados.filter(function (x) { return x.anoMes.substring(0, 4) === anoSel; });
      }
    } else {
      const n = Number(periodo);
      const baseMes = (anoSel && Number(anoSel) < anoAtual) ? 12 : mesAtual - 1;
      const baseAno = anoSel ? Number(anoSel) : anoAtual;
      const meses = [];
      let a = baseAno;
      let m = baseMes;
      for (let i = 0; i < n; i++) {
        meses.push(a + '-' + String(m).padStart(2, '0'));
        m--;
        if (m < 1) { m = 12; a--; }
      }
      dados = dados.filter(function (x) { return meses.indexOf(x.anoMes) !== -1; });
    }

    const totalVendido = dados.reduce(function (s, x) { return s + x.atingido; }, 0);
    const totalMeta = dados.reduce(function (s, x) { return s + x.meta; }, 0);
    const pct = totalMeta > 0 ? (totalVendido / totalMeta) * 100 : 0;

    $('v-rel-total').textContent = fmtQtd(totalVendido) + ' fardos';
    $('v-rel-meta').textContent = fmtQtd(totalMeta) + ' fardos';
    $('v-rel-pct').textContent = fmtPct(pct);
    $('v-rel-cards-resumo').style.display = '';

    if (dados.length) {
      const ordenado = dados.slice().sort(function (a, b) { return b.atingido - a.atingido; });
      const maior = ordenado[0];
      const menor = ordenado[ordenado.length - 1];
      const media = totalVendido / dados.length;

      $('v-rel-maior').textContent = fmtQtd(maior.atingido) + ' fardos';
      $('v-rel-maior-info').textContent = maior.nomeMes;
      $('v-rel-menor').textContent = fmtQtd(menor.atingido) + ' fardos';
      $('v-rel-menor-info').textContent = menor.nomeMes;
      $('v-rel-media').textContent = fmtQtd(media) + ' fardos/mês';
      $('v-rel-cards-insights').style.display = '';
    } else {
      $('v-rel-cards-insights').style.display = 'none';
    }

    if (dados.length > 1) {
      novoGrafico('v-rel-grafico', {
        type: 'bar',
        data: {
          labels: dados.map(function (x) { return x.nomeMes; }),
          datasets: [
            { label: 'Meta', data: dados.map(function (x) { return x.meta; }), backgroundColor: 'rgba(148,163,184,.55)' },
            { label: 'Vendido', data: dados.map(function (x) { return x.atingido; }), backgroundColor: '#16a34a' }
          ]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
      });
      $('v-rel-grafico-wrap').style.display = '';
    } else {
      destruirGrafico('v-rel-grafico');
      $('v-rel-grafico-wrap').style.display = 'none';
    }

    if (dados.length) {
      let linhas = '<tr><th>Mês</th><th>Meta</th><th>Vendido</th><th>%</th></tr>';
      dados.slice().reverse().forEach(function (x) {
        linhas += '<tr><td>' + x.nomeMes + '</td><td>' + fmtQtd(x.meta) + '</td><td>' + fmtQtd(x.atingido) + '</td><td class="tend">' + fmtPct(x.meta > 0 ? (x.atingido / x.meta) * 100 : 0) + '</td></tr>';
      });
      $('v-rel-tabela').innerHTML = linhas;
      $('v-rel-tabela-wrap').style.display = '';
    } else {
      $('v-rel-tabela').innerHTML = '<tr><td class="vazio">Nenhum dado encontrado.</td></tr>';
      $('v-rel-tabela-wrap').style.display = '';
    }
  } catch (e) { alert(e.message); }
}

/* ============================= RELATÓRIOS SUPERVISOR ============================= */

function popularFiltrosRelatorioSupervisor() {
  return api('/api/supervisor/usuarios').then(function (lista) {
    const vends = lista.filter(function (u) { return u.perfil === 'vendedor'; });
    const setores = [...new Set(vends.map(function (u) { return u.setor || ''; }))].filter(Boolean).sort();
    $('sup-rel-setor').innerHTML = '<option value="">Setor</option><option value="todos">Todos</option>' + setores.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
    if (!vends.length) return null;
    const q = vends.map(function (u) { return 'usuario=' + u.id; }).join('&');
    return api('/api/supervisor/relatorios?' + q + '&de=2000-01&ate=2099-12');
  }).then(function (d) {
    if (!d || !d.meses) return;
    const comDados = d.meses.filter(function (m) { return m.atingido > 0 || m.meta > 0; });
    const anos = [...new Set(comDados.map(function (m) { return m.anoMes.substring(0, 4); }))].sort().reverse();
    $('sup-rel-ano')._anos = anos;
    $('sup-rel-ano').innerHTML = '<option value="">Ano</option>' + '<option value="todos">Todos</option>' + anos.map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join('');
  }).catch(function () {});
}

function montarPeriodoSupervisor() {
  const periodo = $('sup-rel-periodo').value;
  const anoBruto = $('sup-rel-ano').value;
  const anoSel = (anoBruto && anoBruto !== 'todos') ? Number(anoBruto) : null;
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  let de, ate;

  if (periodo === 'atual') {
    let a = anoSel || anoAtual;
    let m = mesAtual;
    if (anoSel && anoSel < anoAtual) { m = 12; }
    de = a + '-' + String(m).padStart(2, '0');
    ate = de;
  } else if (periodo === 'anterior') {
    let a = anoSel || anoAtual;
    let m = mesAtual - 1;
    if (m < 1) { m = 12; a--; }
    de = a + '-' + String(m).padStart(2, '0');
    ate = de;
  } else if (periodo === 'ano') {
    if (anoSel) {
      de = anoSel + '-01';
      ate = anoSel + '-12';
    } else {
      const anos = $('sup-rel-ano')._anos || [];
      if (anos.length) {
        de = anos[anos.length - 1] + '-01';
        ate = anos[0] + '-12';
      } else {
        de = anoAtual + '-01';
        ate = anoAtual + '-12';
      }
    }
  } else if (periodo === '3' || periodo === '6') {
    const n = Number(periodo);
    const baseMes = (anoSel && anoSel < anoAtual) ? 12 : mesAtual - 1;
    const baseAno = anoSel || anoAtual;
    const meses = [];
    let a = baseAno;
    let m = baseMes;
    for (let i = 0; i < n; i++) {
      meses.push(a + '-' + String(m).padStart(2, '0'));
      m--;
      if (m < 1) { m = 12; a--; }
    }
    meses.reverse();
    de = meses[0];
    ate = meses[meses.length - 1];
  } else {
    const anos = $('sup-rel-ano')._anos || [];
    if (anos.length) {
      de = anos[anos.length - 1] + '-01';
      ate = anos[0] + '-12';
    } else {
      de = anoAtual + '-01';
      ate = anoAtual + '-12';
    }
  }
  return { de: de, ate: ate, n: periodo === 'ano' ? 12 : (periodo === 'atual' || periodo === 'anterior' ? 1 : Number(periodo)) };
}

async function carregarRelatorioSupervisor() {
  const periodo = $('sup-rel-periodo').value;
  if (!periodo) return;
  const rango = montarPeriodoSupervisor();
  const setorVal = $('sup-rel-setor').value;
  const extra = (setorVal && setorVal !== 'todos') ? '&setor=' + encodeURIComponent(setorVal) : '';
  try {
    const url = '/api/supervisor/relatorios?de=' + rango.de + '&ate=' + rango.ate + extra;
    const d = await api(url);
    renderRelatorio(d, rango.n);
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

  if (!mensal) {
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
    linhas = '<tr><th>Setor</th><th>Nome</th><th>Meta</th><th>Realizado</th><th>Vendas%</th></tr>';
    d.porVendedor.forEach(function (v) {
      const x = v.valores[0] || { meta: 0, atingido: 0 };
      linhas += '<tr><td>' + v.setor + '</td><td>' + v.nome + '</td><td>' + fmtQtd(x.meta) + '</td><td>' + fmtQtd(x.atingido) + '</td><td class="tend">' + fmtPct(x.meta > 0 ? (x.atingido / x.meta) * 100 : 0) + '</td></tr>';
    });
  } else {
    linhas = '<tr><th>Mês</th><th>Meta</th><th>Vendido</th><th>%</th><th>D.U.</th></tr>';
    d.meses.slice().reverse().forEach(function (m) {
      linhas += '<tr><td>' + m.nomeMes + '</td><td>' + fmtQtd(m.meta) + '</td><td>' + fmtQtd(m.atingido) + '</td><td class="tend">' + fmtPct(m.pct) + '</td><td>' + m.utMes + '</td></tr>';
    });
  }
  $('tabela-relatorio').innerHTML = linhas;
}

  $('btn-mu-cancelar').addEventListener('click', fecharModalUsuario);
  $('btn-mu-salvar').addEventListener('click', salvarModalUsuario);
  $('btn-mu-resetar').addEventListener('click', resetarSenhaModal);
  $('btn-mu-excluir').addEventListener('click', excluirUsuario);
$('btn-mp-fechar').addEventListener('click', fecharModalPainel);
$('btn-valor-cancelar').addEventListener('click', fecharModalValor);
$('btn-valor-ok').addEventListener('click', salvarModalValor);
$('inp-valor').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); salvarModalValor(); }
});
$('btn-nome-cancelar').addEventListener('click', fecharModalNome);
$('btn-nome-ok').addEventListener('click', salvarModalNome);
$('inp-nome').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); salvarModalNome(); }
});
$('btn-mm-cancelar').addEventListener('click', fecharModalMes);
$('btn-mm-ok').addEventListener('click', salvarModalMes);
window.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { fecharModalUsuario(); fecharModalSenha(); fecharModalPainel(); fecharModalValor(); fecharModalNome(); fecharModalMes(); }
});

function abrirModalSenha() {
  $('ms-nova').value = '';
  $('ms-erro').classList.add('hidden');
  $('modal-senha').classList.remove('hidden');
  $('ms-nova').focus();
}
function fecharModalSenha() {
  $('modal-senha').classList.add('hidden');
}
async function salvarModalSenha() {
  try {
    await api('/api/auth/trocar-senha', {
      method: 'POST',
      body: {
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
