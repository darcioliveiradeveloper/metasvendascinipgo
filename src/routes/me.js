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

router.post('/nome', async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim();
    if (!nome) {
      return res.status(400).json({ erro: 'Informe seu nome' });
    }
    if (nome.length > 40) {
      return res.status(400).json({ erro: 'Nome muito longo (máx. 40 caracteres)' });
    }
    req.usuario.nome = nome;
    await req.usuario.save();
    res.json(req.usuario.resumo());
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar o nome' });
  }
});

router.put('/historico/:anoMes', async (req, res) => {
  try {
    const { anoMes } = req.params;
    if (!/^\d{4}-\d{2}$/.test(anoMes)) {
      return res.status(400).json({ erro: 'Mês inválido' });
    }
    if (anoMes >= negocio.chaveMesHoje()) {
      return res.status(400).json({ erro: 'Só é possível editar meses passados' });
    }
    const meta = negocio.numerico(req.body.meta);
    const total = negocio.numerico(req.body.total);
    if (meta === null || meta < 0) return res.status(400).json({ erro: 'Meta inválida' });
    if (total === null || total < 0) return res.status(400).json({ erro: 'Total inválido' });

    await MetaMensal.findOneAndUpdate(
      { usuario: req.usuario._id, anoMes },
      { $set: { meta } },
      { upsert: true }
    );

    const existente = await Lancamento.findOne({ usuario: req.usuario._id, anoMes });
    if (existente) {
      existente.total = total;
      await existente.save();
    } else {
      await Lancamento.create({ usuario: req.usuario._id, anoMes, data: new Date(), total });
    }

    res.json(await dash.montarDashboard(req.usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao editar mês' });
  }
});

router.delete('/historico/:anoMes', async (req, res) => {
  try {
    const { anoMes } = req.params;
    if (!/^\d{4}-\d{2}$/.test(anoMes)) {
      return res.status(400).json({ erro: 'Mês inválido' });
    }
    if (anoMes >= negocio.chaveMesHoje()) {
      return res.status(400).json({ erro: 'Só é possível excluir meses passados' });
    }

    await MetaMensal.deleteOne({ usuario: req.usuario._id, anoMes });
    await Lancamento.deleteOne({ usuario: req.usuario._id, anoMes });

    res.json(await dash.montarDashboard(req.usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao excluir mês' });
  }
});

router.post('/incluir-mes', async (req, res) => {
  try {
    const { anoMes } = req.body;
    if (!/^\d{4}-\d{2}$/.test(String(anoMes || ''))) {
      return res.status(400).json({ erro: 'Informe o mês no formato AAAA-MM' });
    }
    if (String(anoMes) >= negocio.chaveMesHoje()) {
      return res.status(400).json({ erro: 'Só é possível incluir meses passados' });
    }
    const meta = negocio.numerico(req.body.meta);
    const total = negocio.numerico(req.body.total);
    if (meta === null || meta < 0) return res.status(400).json({ erro: 'Meta inválida' });
    if (total === null || total < 0) return res.status(400).json({ erro: 'Total inválido' });

    await MetaMensal.findOneAndUpdate(
      { usuario: req.usuario._id, anoMes },
      { $set: { meta } },
      { upsert: true }
    );

    const existente = await Lancamento.findOne({ usuario: req.usuario._id, anoMes });
    if (existente) {
      existente.total = total;
      await existente.save();
    } else {
      await Lancamento.create({
        usuario: req.usuario._id,
        anoMes,
        data: new Date(),
        total
      });
    }

    res.json(await dash.montarDashboard(req.usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao incluir mês' });
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

router.get('/relatorios', async (req, res) => {
  try {
    const user = req.usuario;
    const mesesComDados = new Set();
    const metas = await MetaMensal.find({ usuario: user._id }, { anoMes: 1 });
    metas.forEach((m) => mesesComDados.add(m.anoMes));
    const lancs = await Lancamento.distinct('anoMes', { usuario: user._id });
    lancs.forEach((m) => mesesComDados.add(m));

    const dados = [];
    for (const anoMes of [...mesesComDados].sort()) {
      const m = await MetaMensal.findOne({ usuario: user._id, anoMes });
      const tot = await dash.totalDoMes(user._id, anoMes);
      dados.push({
        anoMes,
        nomeMes: negocio.nomeDoMes(anoMes),
        meta: m ? m.meta : 0,
        atingido: tot,
        pct: m && m.meta > 0 ? (tot / m.meta) * 100 : 0
      });
    }
    res.json({ dados });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao gerar relatório' });
  }
});

module.exports = router;
