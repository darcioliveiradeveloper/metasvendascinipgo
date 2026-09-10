const negocio = require('./negocio');

function diasFeriadosDoMes(chave, manuais) {
  const { ano, mes } = negocio.paraAnoMes0(chave);
  const nacionais = Object.keys(negocio.feriadosNacionaisPorMes(ano, mes)).map(Number);
  const extras = (manuais || [])
    .filter((f) => f.data.startsWith(chave))
    .map((f) => Number(f.data.slice(8, 10)));
  return [...new Set(nacionais.concat(extras))];
}

function listaDoMes(chave, manuais) {
  const { ano, mes } = negocio.paraAnoMes0(chave);
  const nacionais = negocio.feriadosNacionaisPorMes(ano, mes);
  const itens = Object.keys(nacionais).map((dia) => ({
    data: chave + '-' + String(dia).padStart(2, '0'),
    nome: nacionais[dia],
    automatico: true
  }));
  (manuais || []).filter((f) => f.data.startsWith(chave)).forEach((f) => {
    itens.push({ id: f._id, data: f.data, nome: f.nome, automatico: false });
  });
  itens.sort((a, b) => a.data.localeCompare(b.data));
  return itens;
}

module.exports = { diasFeriadosDoMes, listaDoMes };