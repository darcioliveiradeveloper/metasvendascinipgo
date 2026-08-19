require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

function ajustarDNS() {
  return new Promise((resolve) => {
    dns.resolveSrv('_mongodb._tcp.cluster0.eaghblk.mongodb.net', (e) => {
      if (e && e.code === 'ECONNREFUSED') {
        try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}
      }
      resolve();
    });
  });
}

async function listar() {
  await ajustarDNS();
  await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  console.log('Conectado');
  const users = await mongoose.connection.db.collection('usuarios').find({}, { projection: { email: 1, nome: 1, perfil: 1 } }).toArray();
  console.log('Total:', users.length);
  users.forEach(u => console.log(u.perfil + ' | ' + u.email + ' | ' + u.nome));
  await mongoose.disconnect();
}
listar().catch(e => { console.error(e); process.exit(1); });
