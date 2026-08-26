const MetaMensal = require('../models/MetaMensal');
const Lancamento = require('../models/Lancamento');
const User = require('../models/User');
const negocio = require('./negocio');

async function totalDoMes(usuarioId, anoMes) {
  const lanc = await Lancamento.findOne({ usuario: usuarioId, anoMes }).sort({ data: -1, createdAt: -1 });
  return lanc ? lanc.total : 0;
}

async function ultimaAtualizacao(usuarioId, anoMes) {
  const lanc = await Lancamento.findOne({ usuario: usuarioId, anoMes }).sort({ data: -1, createdAt: -1 });
  return lanc ? lanc.createdAt : null;
}

async function definirMesTrabalho(user, chave) {
  user.mesTrabalho = chave;
  await user.save();
  await MetaMensal.findOneAndUpdate(
    { usuario: user._id, anoMes: chave },
    { $setOnInsert: { usuario: user._id, anoMes: chave, meta: 0 } },
    { upsert: true }
  );
}

async function mesAtual(user) {
  let chave = user.mesTrabalho || negocio.chaveMesHoje();
  if (!user.mesTrabalho) {
    await definirMesTrabalho(user, chave);
  }
  const metaRec = await MetaMensal.findOne({ usuario: user._id, anoMes: chave });
  const hojeChave = negocio.chaveMesHoje();
  if (metaRec && metaRec.fechado && chave < hojeChave) {
    chave = hojeChave;
    await definirMesTrabalho(user, chave);
  }
  return chave;
}

async function montarDashboard(user) {
  let alvo = user;
  if (user.perfil === 'suporte') {
    const sup = await User.findOne({ perfil: 'supervisor', ativo: true }).sort({ createdAt: 1 });
    if (sup) alvo = sup;
  }
  const chave = await mesAtual(alvo);
  const metaRec = await MetaMensal.findOne({ usuario: alvo._id, anoMes: chave });
  const meta = metaRec ? metaRec.meta : 0;
  const total = await totalDoMes(alvo._id, chave);
  const calc = negocio.calcular(meta, total, chave);
  const atualizadoEm = await ultimaAtualizacao(alvo._id, chave);

  const mesesComDados = new Set();
  const metas = await MetaMensal.find({ usuario: alvo._id }, { anoMes: 1 });
  metas.forEach((m) => mesesComDados.add(m.anoMes));
  const lancs = await Lancamento.distinct('anoMes', { usuario: alvo._id });
  lancs.forEach((m) => mesesComDados.add(m));

  const historico = [];
  for (const anoMes of [...mesesComDados].sort().reverse()) {
    const m = await MetaMensal.findOne({ usuario: alvo._id, anoMes });
    const tot = await totalDoMes(alvo._id, anoMes);
    if (anoMes === chave) continue;
    historico.push({
      anoMes,
      nomeMes: negocio.nomeDoMes(anoMes),
      meta: m ? m.meta : 0,
      atingido: tot,
      pct: m && m.meta > 0 ? (tot / m.meta) * 100 : 0,
      utMes: negocio.diasUteisMes(...Object.values(negocio.paraAnoMes0(anoMes))),
      fechado: m ? m.fechado : false
    });
  }

  return {
    nome: alvo.nome,
    setor: alvo.setor,
    mes: chave,
    nomeMes: negocio.nomeDoMes(chave),
    meta,
    total,
    calc,
    atualizadoEm,
    fechado: metaRec ? metaRec.fechado : false,
    historico
  };
}

module.exports = { montarDashboard, mesAtual, definirMesTrabalho, totalDoMes, ultimaAtualizacao };
