const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    setor: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senha: { type: String, required: true },
    perfil: { type: String, enum: ['supervisor', 'vendedor'], default: 'vendedor' },
    ativo: { type: Boolean, default: true },
    mesTrabalho: { type: String, default: '' }
  },
  { timestamps: true }
);

userSchema.methods.senhaConfere = function (senha) {
  return bcrypt.compare(senha, this.senha);
};

userSchema.methods.resumo = function () {
  return {
    id: this._id,
    nome: this.nome,
    setor: this.setor,
    email: this.email,
    perfil: this.perfil,
    ativo: this.ativo,
    mesTrabalho: this.mesTrabalho
  };
};

module.exports = mongoose.model('User', userSchema);
