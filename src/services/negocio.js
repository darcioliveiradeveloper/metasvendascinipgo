const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function ehDiaUtil(d) {
  const dia = d.getDay();
  return dia >= 1 && dia <= 5;
}

function ultimoDiaMes(ano, mes0) {
  return new Date(ano, mes0 + 1, 0).getDate();
}

function diasUteisMes(ano, mes0) {
  let c = 0;
  const n = ultimoDiaMes(ano, mes0);
  for (let d = 1; d <= n; d++) if (ehDiaUtil(new Date(ano, mes0, d))) c++;
  return c;
}

function diasTrabalhados(ano, mes0, diaCalc) {
  let c = 0;
  for (let d = 1; d < diaCalc; d++) if (ehDiaUtil(new Date(ano, mes0, d))) c++;
  return c;
}

function diasRestantes(ano, mes0, diaCalc) {
  let c = 0;
  const n = ultimoDiaMes(ano, mes0);
  for (let d = diaCalc; d <= n; d++) if (ehDiaUtil(new Date(ano, mes0, d))) c++;
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

function calcular(meta, total, anoMes, hoje) {
  const h = hoje || new Date();
  const w = paraAnoMes0(anoMes);
  const diaCalc = diaNoMesDeTrabalho(w, h);
  const trab = diasTrabalhados(w.ano, w.mes, diaCalc);
  const rest = diasRestantes(w.ano, w.mes, diaCalc);
  const utMes = diasUteisMes(w.ano, w.mes);

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
