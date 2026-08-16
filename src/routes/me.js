const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const MetaMensal = require('../models/MetaMensal');
const Lancamento = require('../models/Lancamento');
const negocio = require('../services/negocio');
const { exigirLogin, carregarUsuario } = require('../middleware/auth');

const router = express.Router();

router.use(exigirLogin, carregarUsuario);

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
  const chave = await mesAtual(user);
  const metaRec = await MetaMensal.findOne({ usuario: user._id, anoMes: chave });
  const meta = metaRec ? metaRec.meta : 0;
  const total = await totalDoMes(user._id, chave);
  const calc = negocio.calcular(meta, total, chave);
  const atualizadoEm = await ultimaAtualizacao(user._id, chave);

  const mesesComDados = new Set();
  const metas = await MetaMensal.find({ usuario: user._id }, { anoMes: 1 });
  metas.forEach((m) => mesesComDados.add(m.anoMes));
  const lancs = await Lancamento.distinct('anoMes', { usuario: user._id });
  lancs.forEach((m) => mesesComDados.add(m));

  const historico = [];
  for (const anoMes of [...mesesComDados].sort().reverse()) {
    const m = await MetaMensal.findOne({ usuario: user._id, anoMes });
    const tot = await totalDoMes(user._id, anoMes);
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

router.get('/dashboard', async (req, res) => {
  try {
    res.json(await montarDashboard(req.usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao montar o painel' });
  }
});

router.post('/lancar', async (req, res) => {
  try {
    const total = negocio.numerico(req.body.total);
    if (total === null || total < 0) {
      return res.status(400).json({ erro: 'Informe um valor válido (fardos)' });
    }
    const chave = await mesAtual(req.usuario);
    const metaRec = await MetaMensal.findOne({ usuario: req.usuario._id, anoMes: chave });
    if (metaRec && metaRec.fechado) {
      return res.status(400).json({ erro: 'Este mês já foi fechado' });
    }
    await Lancamento.create({
      usuario: req.usuario._id,
      anoMes: chave,
      data: new Date(),
      total
    });
    res.json(await montarDashboard(req.usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao lançar vendas' });
  }
});

router.post('/meta', async (req, res) => {
  try {
    const meta = negocio.numerico(req.body.meta);
    if (meta === null || meta < 0) {
      return res.status(400).json({ erro: 'Informe uma meta válida (fardos)' });
    }
    const chave = await mesAtual(req.usuario);
    await MetaMensal.findOneAndUpdate(
      { usuario: req.usuario._id, anoMes: chave },
      { $set: { meta } },
      { upsert: true }
    );
    res.json(await montarDashboard(req.usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao definir meta' });
  }
});

router.post('/iniciar-mes', async (req, res) => {
  try {
    await definirMesTrabalho(req.usuario, negocio.chaveMesHoje());
    res.json(await montarDashboard(req.usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao iniciar mês' });
  }
});

router.post('/fechar-mes', async (req, res) => {
  try {
    const chave = await mesAtual(req.usuario);
    const metaRec = await MetaMensal.findOneAndUpdate(
      { usuario: req.usuario._id, anoMes: chave },
      { $set: { fechado: true, fechadoEm: new Date() } },
      { upsert: true }
    );
    const proximo = negocio.proximoMes(chave);
    await definirMesTrabalho(req.usuario, proximo);
    res.json({ fechado: { anoMes: chave, nomeMes: negocio.nomeDoMes(chave) }, dashboard: await montarDashboard(req.usuario) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao fechar mês' });
  }
});

module.exports = router;
