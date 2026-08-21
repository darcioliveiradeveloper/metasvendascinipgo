const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const MetaMensal = require('../models/MetaMensal');
const Lancamento = require('../models/Lancamento');
const negocio = require('../services/negocio');
const { exigirLogin, exigirSupervisor, carregarUsuario } = require('../middleware/auth');

const router = express.Router();

router.use(exigirLogin, carregarUsuario, exigirSupervisor);

function listaDeMeses(de, ate) {
  const meses = [];
  const [a1, m1] = de.split('-').map(Number);
  const [a2, m2] = ate.split('-').map(Number);
  let a = a1;
  let m = m1;
  while (a < a2 || (a === a2 && m <= m2)) {
    meses.push(a + '-' + String(m).padStart(2, '0'));
    m++;
    if (m > 12) { m = 1; a++; }
  }
  return meses;
}

async function totaisPorMes(ids, meses) {
  const ag = await Lancamento.aggregate([
    { $match: { usuario: { $in: ids }, anoMes: { $in: meses } } },
    { $sort: { data: -1, createdAt: -1 } },
    { $group: { _id: { usuario: '$usuario', anoMes: '$anoMes' }, total: { $first: '$total' } } }
  ]);
  const mapa = {};
  ag.forEach((r) => { mapa[r._id.anoMes + '|' + r._id.usuario] = r.total; });
  return mapa;
}

router.get('/', async (req, res) => {
  try {
    const de = /^\d{4}-\d{2}$/.test(req.query.de || '') ? req.query.de : negocio.chaveMesHoje();
    const ate = /^\d{4}-\d{2}$/.test(req.query.ate || '') ? req.query.ate : de;
    const meses = listaDeMeses(de, ate);

    let usuarios;
    if (req.query.usuario && mongoose.Types.ObjectId.isValid(req.query.usuario)) {
      usuarios = await User.find({ _id: req.query.usuario, perfil: 'vendedor', ativo: true });
    } else {
      usuarios = await User.find({ perfil: 'vendedor', ativo: true }).sort({ setor: 1, nome: 1 });
    }
    const ids = usuarios.map((u) => u._id);

    const metas = await MetaMensal.find({ usuario: { $in: ids }, anoMes: { $in: meses } });
    const mapaMeta = {};
    metas.forEach((m) => { mapaMeta[m.anoMes + '|' + m.usuario.toString()] = m.meta; });
    const mapTotais = await totaisPorMes(ids, meses);

    const serie = meses.map((anoMes) => {
      let meta = 0;
      let atingido = 0;
      usuarios.forEach((u) => {
        meta += mapaMeta[anoMes + '|' + u._id.toString()] || 0;
        atingido += mapTotais[anoMes + '|' + u._id] || 0;
      });
      return {
        anoMes,
        nomeMes: negocio.nomeDoMes(anoMes),
        meta,
        atingido,
        pct: meta > 0 ? (atingido / meta) * 100 : 0,
        utMes: negocio.diasUteisMes(...Object.values(negocio.paraAnoMes0(anoMes)))
      };
    });

    const porVendedor = usuarios.map((u) => ({
      id: u._id,
      nome: u.nome,
      setor: u.setor,
      valores: meses.map((anoMes) => ({
        anoMes,
        meta: mapaMeta[anoMes + '|' + u._id.toString()] || 0,
        atingido: mapTotais[anoMes + '|' + u._id] || 0
      }))
    }));

    const totalMeta = serie.reduce((s, m) => s + m.meta, 0);
    const totalAtingido = serie.reduce((s, m) => s + m.atingido, 0);

    res.json({
      de,
      ate,
      meses: serie,
      porVendedor,
      totalMeta,
      totalAtingido,
      pctGeral: totalMeta > 0 ? (totalAtingido / totalMeta) * 100 : 0
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao gerar relatório' });
  }
});

module.exports = router;
