const express = require('express');
const MetaMensal = require('../models/MetaMensal');
const Lancamento = require('../models/Lancamento');
const negocio = require('../services/negocio');
const dash = require('../services/dashboard');
const { exigirLogin, carregarUsuario } = require('../middleware/auth');

const router = express.Router();

router.use(exigirLogin, carregarUsuario);

router.get('/dashboard', async (req, res) => {
  try {
    res.json(await dash.montarDashboard(req.usuario));
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
    const chave = await dash.mesAtual(req.usuario);
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
    res.json(await dash.montarDashboard(req.usuario));
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
    const chave = await dash.mesAtual(req.usuario);
    await MetaMensal.findOneAndUpdate(
      { usuario: req.usuario._id, anoMes: chave },
      { $set: { meta } },
      { upsert: true }
    );
    res.json(await dash.montarDashboard(req.usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao definir meta' });
  }
});

router.post('/iniciar-mes', async (req, res) => {
  try {
    await dash.definirMesTrabalho(req.usuario, negocio.chaveMesHoje());
    res.json(await dash.montarDashboard(req.usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao iniciar mês' });
  }
});

router.post('/fechar-mes', async (req, res) => {
  try {
    const chave = await dash.mesAtual(req.usuario);
    const metaRec = await MetaMensal.findOneAndUpdate(
      { usuario: req.usuario._id, anoMes: chave },
      { $set: { fechado: true, fechadoEm: new Date() } },
      { upsert: true }
    );
    const proximo = negocio.proximoMes(chave);
    await dash.definirMesTrabalho(req.usuario, proximo);
    res.json({ fechado: { anoMes: chave, nomeMes: negocio.nomeDoMes(chave) }, dashboard: await dash.montarDashboard(req.usuario) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao fechar mês' });
  }
});

module.exports = router;
