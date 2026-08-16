const jwt = require('jsonwebtoken');
const User = require('../models/User');

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario._id, perfil: usuario.perfil },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function exigirLogin(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ erro: 'Sessão expirada, entre novamente' });
  }
  req.usuarioToken = payload;
  next();
}

function exigirSupervisor(req, res, next) {
  if (req.usuarioToken.perfil !== 'supervisor') {
    return res.status(403).json({ erro: 'Acesso restrito ao supervisor' });
  }
  next();
}

async function carregarUsuario(req, res, next) {
  try {
    const user = await User.findById(req.usuarioToken.id);
    if (!user || !user.ativo) {
      return res.status(401).json({ erro: 'Usuário inativo ou não encontrado' });
    }
    req.usuario = user;
    next();
  } catch (e) {
    return res.status(500).json({ erro: 'Erro ao carregar usuário' });
  }
}

module.exports = { gerarToken, exigirLogin, exigirSupervisor, carregarUsuario };
