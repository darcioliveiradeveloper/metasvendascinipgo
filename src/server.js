require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const conectar = require('./config/db');
const User = require('./models/User');
const rotasAuth = require('./routes/auth');
const rotasMe = require('./routes/me');
const rotasSupervisor = require('./routes/supervisor');
const rotasRelatorios = require('./routes/relatorios');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', rotasAuth);
app.use('/api/me', rotasMe);
app.use('/api/supervisor', rotasSupervisor);
app.use('/api/supervisor/relatorios', rotasRelatorios);

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

async function criarSupervisorInicial() {
  const existe = await User.findOne({ perfil: 'supervisor' });
  if (existe) return;
  const email = (process.env.EMAIL_SUPERVISOR_INICIAL || 'supervisor@exemplo.com').toLowerCase().trim();
  const senha = process.env.SENHA_SUPERVISOR_INICIAL || 'admin123';
  const nome = process.env.NOME_SUPERVISOR_INICIAL || 'Supervisor';
  const hash = await bcrypt.hash(senha, 10);
  await User.create({ nome, setor: '', email, senha: hash, perfil: 'supervisor' });
  console.log('Supervisor inicial criado: ' + email + ' / senha: ' + senha);
}

async function iniciar() {
  await conectar();
  await criarSupervisorInicial();
  const porta = process.env.PORT || 3000;
  app.listen(porta, () => {
    console.log('Servidor rodando em http://localhost:' + porta);
  });
}

iniciar().catch((e) => {
  console.error('Falha ao iniciar:', e.message);
  process.exit(1);
});
