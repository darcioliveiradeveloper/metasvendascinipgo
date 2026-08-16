require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

function hostDoMongoUrl() {
  const url = process.env.MONGO_URL || '';
  if (!/^mongodb(?:\+srv)?:\/\//.test(url)) return '';
  return url.replace(/^mongodb(?:\+srv)?:\/\//, '').split('@').pop().split('/')[0];
}

function ajustarResolvedorDns() {
  const host = hostDoMongoUrl();
  if (!host) return Promise.resolve();
  return new Promise((resolve) => {
    dns.resolveSrv('_mongodb._tcp.' + host, (e) => {
      if (e && e.code === 'ECONNREFUSED') {
        try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}
      }
      resolve();
    });
  });
}

async function conectar() {
  const url = process.env.MONGO_URL;
  if (!url) {
    throw new Error('Defina MONGO_URL no arquivo .env (veja .env.example)');
  }
  await ajustarResolvedorDns();
  await mongoose.connect(url, { serverSelectionTimeoutMS: 15000 });
  console.log('MongoDB conectado');
}

module.exports = conectar;
