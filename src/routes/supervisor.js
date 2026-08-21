const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const MetaMensal = require('../models/MetaMensal');
const Lancamento = require('../models/Lancamento');
const negocio = require('../services/negocio');
const dash = require('../services/dashboard');
const { exigirLogin, exigirSupervisor, carregarUsuario } = require('../middleware/auth');

const router = express.Router();

router.use(exigirLogin, carregarUsuario, exigirSupervisor);

function idValido(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function podeGerenciar(requester, alvo) {
  if (requester.perfil === 'suporte') return true;
  return requester.perfil === 'supervisor' && alvo.perfil === 'vendedor';
}

function gerarSenhaTemporaria() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let senha = '';
  for (let i = 0; i < 6; i++) {
    senha += chars[Math.floor(Math.random() * chars.length)];
  }
  return senha;
}

async function totaisPorMes(ids, meses) {
  const ag = await Lancamento.aggregate([
    { $match: { usuario: { $in: ids }, anoMes: { $in: meses } } },
    { $sort: { data: -1, createdAt: -1 } },
    { $group: { _id: { usuario: '$usuario', anoMes: '$anoMes' }, total: { $first: '$total' } } }
  ]);
  const mapa = {};
  ag.forEach((r) => {
    mapa[r._id.anoMes + '|' + r._id.usuario] = r.total;
  });
  return mapa;
}

// GET /api/supervisor/dashboard?mes=YYYY-MM
router.get('/dashboard', async (req, res) => {
  try {
    const chave = req.query.mes || negocio.chaveMesHoje();
    const vendedores = await User.find({ perfil: 'vendedor', ativo: true }).sort({ setor: 1, nome: 1 });
    const ids = vendedores.map((u) => u._id);
    const metas = await MetaMensal.find({ usuario: { $in: ids }, anoMes: chave });
    const mapaMeta = {};
    metas.forEach((m) => { mapaMeta[m.usuario.toString()] = m.meta; });
    const mapTotais = await totaisPorMes(ids, [chave]);

    let totalMeta = 0;
    let totalAtingido = 0;
    const linhas = vendedores.map((u) => {
      const meta = mapaMeta[u._id.toString()] || 0;
      const atingido = mapTotais[chave + '|' + u._id] || 0;
      totalMeta += meta;
      totalAtingido += atingido;
      return {
        id: u._id,
        nome: u.nome,
        setor: u.setor,
        meta,
        atingido,
        calc: negocio.calcular(meta, atingido, chave)
      };
    });

    res.json({
      mes: chave,
      nomeMes: negocio.nomeDoMes(chave),
      totalMeta,
      totalAtingido,
      calc: negocio.calcular(totalMeta, totalAtingido, chave),
      pctGeral: totalMeta > 0 ? (totalAtingido / totalMeta) * 100 : 0,
      linhas
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro no painel do supervisor' });
  }
});

router.get('/usuarios', async (req, res) => {
  try {
    const filtro = req.usuario.perfil === 'suporte' ? {} : { perfil: 'vendedor' };
    const usuarios = await User.find(filtro).sort({ perfil: -1, setor: 1, nome: 1 });
    res.json(usuarios.map((u) => u.resumo()));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar usuários' });
  }
});

// GET /api/supervisor/usuarios/:id/painel  (visualizar o painel de outro usuário)
router.get('/usuarios/:id/painel', async (req, res) => {
  try {
    const { id } = req.params;
    if (!idValido(id)) return res.status(400).json({ erro: 'Id inválido' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (!podeGerenciar(req.usuario, user)) {
      return res.status(403).json({ erro: 'Sem permissão para ver este painel' });
    }
    res.json(await dash.montarDashboard(user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao montar o painel' });
  }
});

router.post('/usuarios', async (req, res) => {
  try {
    const { nome, setor, email } = req.body;
    const senha = String(req.body.senha || '');
    const perfilSolicitado = String(req.body.perfil || 'vendedor');
    if (!nome || !email || !senha || senha.length < 4) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha (mín. 4 caracteres) são obrigatórios' });
    }
    let perfilFinal = 'vendedor';
    if (perfilSolicitado === 'supervisor') {
      if (req.usuario.perfil !== 'suporte') {
        return res.status(403).json({ erro: 'Somente o suporte pode criar supervisores' });
      }
      perfilFinal = 'supervisor';
    }
    const emailOk = String(email).toLowerCase().trim();
    const existe = await User.findOne({ email: emailOk });
    if (existe) {
      return res.status(400).json({ erro: 'Já existe usuário com este e-mail' });
    }
    const hash = await bcrypt.hash(senha, 10);
    const user = await User.create({
      nome: String(nome).trim(),
      setor: String(setor || '').trim(),
      email: emailOk,
      senha: hash,
      perfil: perfilFinal
    });
    res.status(201).json(user.resumo());
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

router.put('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!idValido(id)) return res.status(400).json({ erro: 'Id inválido' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (!podeGerenciar(req.usuario, user)) {
      return res.status(403).json({ erro: 'Sem permissão para editar este usuário' });
    }

    if (req.body.nome !== undefined) user.nome = String(req.body.nome).trim();
    if (req.body.setor !== undefined) user.setor = String(req.body.setor || '').trim();
    if (req.body.email !== undefined) {
      const emailOk = String(req.body.email).toLowerCase().trim();
      const outro = await User.findOne({ email: emailOk, _id: { $ne: user._id } });
      if (outro) return res.status(400).json({ erro: 'E-mail já em uso por outro usuário' });
      user.email = emailOk;
    }
    if (req.body.perfil !== undefined) {
      if (user.perfil === 'suporte' || req.usuario.perfil !== 'suporte') {
        return res.status(403).json({ erro: 'Perfil não pode ser alterado' });
      }
      const novo = String(req.body.perfil);
      if (novo !== 'vendedor' && novo !== 'supervisor') {
        return res.status(400).json({ erro: 'Perfil inválido' });
      }
      if (user.perfil === 'supervisor' && novo !== 'supervisor') {
        const quantosSuper = await User.countDocuments({ perfil: 'supervisor' });
        if (quantosSuper <= 1) return res.status(400).json({ erro: 'Deve existir pelo menos um supervisor' });
      }
      user.perfil = novo;
    }
    if (req.body.ativo !== undefined) {
      if (user.perfil === 'suporte') {
        const quantosSup = await User.countDocuments({ perfil: 'suporte' });
        if (!req.body.ativo && quantosSup <= 1) {
          return res.status(400).json({ erro: 'Deve existir pelo menos um suporte' });
        }
      }
      user.ativo = !!req.body.ativo;
    }
    if (req.body.senha) {
      if (String(req.body.senha).length < 4) return res.status(400).json({ erro: 'Senha muito curta (mín. 4)' });
      user.senha = await bcrypt.hash(String(req.body.senha), 10);
    }
    await user.save();
    res.json(user.resumo());
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar usuário' });
  }
});

router.post('/usuarios/:id/resetar-senha', async (req, res) => {
  try {
    const { id } = req.params;
    if (!idValido(id)) return res.status(400).json({ erro: 'Id inválido' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (!podeGerenciar(req.usuario, user)) {
      return res.status(403).json({ erro: 'Sem permissão para resetar a senha' });
    }
    const nova = user.setor || user.email.split('@')[0];
    user.senha = await bcrypt.hash(nova, 10);
    await user.save();
    res.json({ ok: true, senha: nova });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao resetar a senha' });
  }
});

router.put('/usuarios/:id/meta', async (req, res) => {
  try {
    if (req.usuario.perfil !== 'supervisor') {
      return res.status(403).json({ erro: 'Somente o supervisor pode definir metas' });
    }
    const { id } = req.params;
    if (!idValido(id)) return res.status(400).json({ erro: 'Id inválido' });
    const meta = negocio.numerico(req.body.meta);
    if (meta === null || meta < 0) return res.status(400).json({ erro: 'Meta inválida' });
    const anoMes = String(req.body.anoMes || negocio.chaveMesHoje());
    if (!/^\d{4}-\d{2}$/.test(anoMes)) return res.status(400).json({ erro: 'Mês inválido (use YYYY-MM)' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (user.perfil !== 'vendedor') {
      return res.status(403).json({ erro: 'Meta só pode ser definida para vendedores' });
    }
    await MetaMensal.findOneAndUpdate(
      { usuario: user._id, anoMes },
      { $set: { meta } },
      { upsert: true }
    );
    res.json({ ok: true, usuario: id, anoMes, meta });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao definir meta' });
  }
});

module.exports = router;
