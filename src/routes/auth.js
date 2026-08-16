const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { gerarToken, exigirLogin, carregarUsuario } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const senha = String(req.body.senha || '');
    const user = await User.findOne({ email });
    if (!user || !(await user.senhaConfere(senha))) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    if (!user.ativo) {
      return res.status(403).json({ erro: 'Usuário desativado. Procure o supervisor.' });
    }
    const token = gerarToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json(user.resumo());
  } catch (e) {
    res.status(500).json({ erro: 'Erro no login' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', exigirLogin, carregarUsuario, (req, res) => {
  res.json(req.usuario.resumo());
});

router.post('/trocar-senha', exigirLogin, carregarUsuario, async (req, res) => {
  try {
    const senhaAtual = String(req.body.senhaAtual || '');
    const novaSenha = String(req.body.novaSenha || '');
    if (novaSenha.length < 4) {
      return res.status(400).json({ erro: 'Senha nova muito curta (mínimo 4 caracteres)' });
    }
    if (!(await req.usuario.senhaConfere(senhaAtual))) {
      return res.status(400).json({ erro: 'Senha atual incorreta' });
    }
    req.usuario.senha = await bcrypt.hash(novaSenha, 10);
    await req.usuario.save();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao trocar a senha' });
  }
});

module.exports = router;
