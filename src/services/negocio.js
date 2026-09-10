const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { ano, mes0: mes - 1, dia };
}

function somaDias(dia, mes0, ano, qt) {
  const dt = new Date(ano, mes0, dia + qt);
  return { dia: dt.getDate(), mes0: dt.getMonth() };
}

function feriadosNacionais(ano) {
  const fixos = [
    { dia: 1, mes0: 0, nome: 'Confraternização Universal' },
    { dia: 21, mes0: 3, nome: 'Tiradentes' },
    { dia: 1, mes0: 4, nome: 'Dia do Trabalho' },
    { dia: 7, mes0: 8, nome: 'Independência do Brasil' },
    { dia: 12, mes0: 9, nome: 'Nossa Senhora Aparecida' },
    { dia: 2, mes0: 10, nome: 'Finados' },
    { dia: 15, mes0: 10, nome: 'Proclamação da República' },
    { dia: 25, mes0: 11, nome: 'Natal' }
  ];
  const p = pascoa(ano);
  const carn = somaDias(p.dia, p.mes0, ano, -47);
  const sexta = somaDias(p.dia, p.mes0, ano, -2);
  const corpus = somaDias(p.dia, p.mes0, ano, 60);
  const moveis = [
    { dia: carn.dia, mes0: carn.mes0, nome: 'Carnaval' },
    { dia: sexta.dia, mes0: sexta.mes0, nome: 'Sexta-feira Santa' },
    { dia: p.dia, mes0: p.mes0, nome: 'Páscoa' },
    { dia: corpus.dia, mes0: corpus.mes0, nome: 'Corpus Christi' }
  ];
  return fixos.concat(moveis);
}

function feriadosNacionaisPorMes(ano, mes0) {
  const mapa = {};
  feriadosNacionais(ano).forEach(function (f) {
    if (f.mes0 === mes0) mapa[f.dia] = f.nome;
  });
  return mapa;
}

function ehDiaUtil(d, diasFeriado) {
  const dia = d.getDay();
  if (dia >= 1 && dia <= 5) {
    if (Array.isArray(diasFeriado) && diasFeriado.indexOf(d.getDate()) !== -1) return false;
    return true;
  }
  return false;
}

function ultimoDiaMes(ano, mes0) {
  return new Date(ano, mes0 + 1, 0).getDate();
}

function diasUteisMes(ano, mes0, diasFeriado) {
  let c = 0;
  const n = ultimoDiaMes(ano, mes0);
  for (let d = 1; d <= n; d++) if (ehDiaUtil(new Date(ano, mes0, d), diasFeriado)) c++;
  return c;
}

function diasTrabalhados(ano, mes0, diaCalc, diasFeriado) {
  let c = 0;
  for (let d = 1; d < diaCalc; d++) if (ehDiaUtil(new Date(ano, mes0, d), diasFeriado)) c++;
  return c;
}

function diasRestantes(ano, mes0, diaCalc, diasFeriado) {
  let c = 0;
  const n = ultimoDiaMes(ano, mes0);
  for (let d = diaCalc; d <= n; d++) if (ehDiaUtil(new Date(ano, mes0, d), diasFeriado)) c++;
  return c;
}

function chaveMesHoje(hoje) {
  const h = hoje || new Date();
  return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0');
}

function proximoMes(chave) {
  const p = chave.split('-');
  let m = Number(p[1]);
  let a = Number(p[0]);
  m++;
  if (m > 12) { m = 1; a++; }
  return a + '-' + String(m).padStart(2, '0');
}

function paraAnoMes0(chave) {
  const p = chave.split('-');
  return { ano: Number(p[0]), mes: Number(p[1]) - 1 };
}

function nomeDoMes(chave) {
  const { ano, mes } = paraAnoMes0(chave);
  return NOMES_MESES[mes] + ' ' + ano;
}

function diaNoMesDeTrabalho(w, hoje) {
  const ultDia = ultimoDiaMes(w.ano, w.mes);
  const hojeDia = hoje.getDate();
  const agoraMes0 = hoje.getMonth();
  const agoraAno = hoje.getFullYear();
  if (w.ano === agoraAno && w.mes === agoraMes0) return hojeDia;
  if (w.ano > agoraAno || (w.ano === agoraAno && w.mes > agoraMes0)) {
    return Math.min(hojeDia, ultDia);
  }
  return ultDia + 1;
}

function calcular(meta, total, anoMes, hoje, diasFeriado) {
  const h = hoje || new Date();
  const w = paraAnoMes0(anoMes);
  const diaCalc = diaNoMesDeTrabalho(w, h);
  const trab = diasTrabalhados(w.ano, w.mes, diaCalc, diasFeriado);
  const rest = diasRestantes(w.ano, w.mes, diaCalc, diasFeriado);
  const utMes = diasUteisMes(w.ano, w.mes, diasFeriado);

  const temTendencia = trab > 0 && meta > 0;
  const media = temTendencia ? total / trab : 0;
  const projetado = temTendencia ? media * utMes : 0;
  const tendencia = temTendencia ? (projetado / meta) * 100 : 0;

  const temMetaDia = rest > 0 && meta > 0;
  const metaDiaria = temMetaDia ? Math.max(0, meta - total) / rest : 0;

  const atingidoPct = meta > 0 ? (total / meta) * 100 : 0;

  return {
    diaCalc,
    trab,
    rest,
    utMes,
    media,
    projetado,
    tendencia,
    metaDiaria,
    atingidoPct,
    mesPassado: w.ano < h.getFullYear() || (w.ano === h.getFullYear() && w.mes < h.getMonth())
  };
}

function numerico(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

module.exports = {
  NOMES_MESES,
  pascoa,
  feriadosNacionais,
  feriadosNacionaisPorMes,
  ehDiaUtil,
  ultimoDiaMes,
  diasUteisMes,
  diasTrabalhados,
  diasRestantes,
  chaveMesHoje,
  proximoMes,
  paraAnoMes0,
  nomeDoMes,
  diaNoMesDeTrabalho,
  calcular,
  numerico
};
