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
  $('btn-sair').addEventListener('click', sairSistema);
  $('perfil-badge').addEventListener('click', abrirModalNome);
  api('/api/auth/me')
    .then(function (me) {
      MEU_USUARIO = me;
      $('saudacao').innerHTML = '<b>' + me.nome + '</b>' + (me.setor ? ' - ' + me.setor : '');
      $('perfil-badge').textContent = me.perfil === 'supervisor' ? 'Supervisor' : me.perfil === 'suporte' ? 'Suporte' : 'Vendedor';
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

function renderHistorico(hist) {
  const tabela = $('tabela-historico');
  if (!hist.length) {
    tabela.innerHTML = '<tr><td class="vazio">Nenhum mês finalizado ainda.</td></tr>';
    destruirGrafico('grafico-historico');
    return;
  }
  let linhas = '<tr><th>Mês</th><th>Meta</th><th>Atingido</th><th>%</th><th>D.U.</th><th></th></tr>';
  hist.forEach(function (h) {
    linhas += '<tr><td>' + h.nomeMes + '</td><td>' + fmtQtd(h.meta) + '</td><td>' + fmtQtd(h.atingido) + '</td><td class="tend">' + fmtPct(h.pct) + '</td><td>' + h.utMes + '</td>'
      + '<td class="hist-acoes"><button class="btn-icon" data-edita-mes="' + h.anoMes + '" title="Editar mês">✎</button>'
      + ' <button class="btn-icon perigo" data-deleta-mes="' + h.anoMes + '" title="Excluir mês">✕</button></td></tr>';
  });
  tabela.innerHTML = linhas;

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
  $('view-supervisor').classList.remove('hidden');
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
  $('btn-gerar').addEventListener('click', carregarRelatorio);
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
  preencherFiltroVendedor();
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
  } catch (e) { alert(e.message); }
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
  let linhas = '<tr><th>Mês</th><th>Meta</th><th>Atingido</th><th>%</th><th>D.U.</th><th></th></tr>';
  hist.forEach(function (h) {
    linhas += '<tr><td>' + h.nomeMes + '</td><td>' + fmtQtd(h.meta) + '</td><td>' + fmtQtd(h.atingido) + '</td><td class="tend">' + fmtPct(h.pct) + '</td><td>' + h.utMes + '</td>'
      + '<td class="hist-acoes"><button class="btn-icon" data-sp-edita-mes="' + h.anoMes + '" title="Editar mês">✎</button>'
      + ' <button class="btn-icon perigo" data-sp-deleta-mes="' + h.anoMes + '" title="Excluir mês">✕</button></td></tr>';
  });
  tabela.innerHTML = linhas;

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

  let linhas = '<tr><th>Vendedor</th><th>Setor</th><th>Meta</th><th>Vendido</th><th>%</th></tr>';
  d.linhas.sort(function (a, b) {
    const sa = (a.setor || '').localeCompare(b.setor || '', undefined, { numeric: true });
    return sa !== 0 ? sa : (a.nome || '').localeCompare(b.nome || '');
  }).forEach(function (l) {
    const tend = l.calc.tendencia > 0 ? ' · tendência ' + fmtPct(l.calc.tendencia) : '';
    const linha = '<tr><td>' + esc(l.nome) + '</td><td>' + esc(l.setor || '—') + '</td><td>' + fmtQtd(l.meta) + '</td><td>' + fmtQtd(l.atingido) + '</td><td class="tend">' + fmtPct(l.calc.atingidoPct) + tend + '</td></tr>';
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
    let linhas = '<tr><th>Nome</th><th>Setor</th><th>Situação</th><th></th></tr>';
    vendedores.forEach(function (u) {
      linhas += '<tr><td>' + esc(u.nome) + '</td><td>' + esc(u.setor || '—') + '</td><td>' + (u.ativo ? 'Ativo' : 'Inativo') + '</td><td>'
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
  let linhas = '<tr><th>Mês</th><th>Meta</th><th>Atingido</th><th>%</th><th>D.U.</th></tr>';
  d.historico.forEach(function (h) {
    linhas += '<tr><td>' + h.nomeMes + '</td><td>' + fmtQtd(h.meta) + '</td><td>' + fmtQtd(h.atingido) + '</td><td class="tend">' + fmtPct(h.pct) + '</td><td>' + h.utMes + '</td></tr>';
  });
  tabela.innerHTML = linhas;

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
      const opcoes = lista.filter((u) => u.perfil === 'vendedor')
        .sort(function (a, b) {
          const sa = (a.setor || '').localeCompare(b.setor || '', undefined, { numeric: true });
          return sa !== 0 ? sa : (a.nome || '').localeCompare(b.nome || '');
        })
        .map((u) => '<option value="' + u.id + '">' + (u.setor ? u.setor + ' - ' : '') + u.nome + '</option>')
        .join('');
      $('filtro-vendedor').innerHTML = '<option value="">Todos os vendedores</option>' + opcoes;
    })
    .catch(function () {});
}

  $('btn-mu-cancelar').addEventListener('click', fecharModalUsuario);
  $('btn-mu-salvar').addEventListener('click', salvarModalUsuario);
  $('btn-mu-resetar').addEventListener('click', resetarSenhaModal);
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
