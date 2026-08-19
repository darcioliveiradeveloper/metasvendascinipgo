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

async function trocar() {
  await ajustarDNS();
  await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  console.log('Conectado');
  const db = mongoose.connection.db;
  
  const sup = await db.collection('usuarios').findOne({ perfil: 'suporte' });
  if (!sup) {
    console.log('Nenhum suporte encontrado. Listando todos:');
    const all = await db.collection('usuarios').find({}, { projection: { email: 1, nome: 1, perfil: 1, setor: 1 } }).toArray();
    all.forEach(u => console.log(u.perfil + ' | ' + u.email + ' | ' + u.nome + ' | ' + u.setor));
    await mongoose.disconnect();
    return;
  }
  
  console.log('Suporte encontrado:', sup.email, sup.nome);
  if (sup.email === 'suporte@cini.com.br') {
    console.log('Ja esta com o email correto!');
    await mongoose.disconnect();
    return;
  }
  
  const r = await db.collection('usuarios').updateOne(
    { _id: sup._id },
    { $set: { email: 'suporte@cini.com.br' } }
  );
  console.log(r.modifiedCount ? 'E-mail alterado com sucesso!' : 'Nenhuma alteracao.');
  await mongoose.disconnect();
}
trocar().catch(e => { console.error(e); process.exit(1); });
