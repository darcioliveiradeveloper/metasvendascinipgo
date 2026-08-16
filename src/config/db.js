require('dotenv').config();
const mongoose = require('mongoose');

async function conectar() {
  const url = process.env.MONGO_URL;
  if (!url) {
    throw new Error('Defina MONGO_URL no arquivo .env (veja .env.example)');
  }
  await mongoose.connect(url, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB conectado');
}

module.exports = conectar;
