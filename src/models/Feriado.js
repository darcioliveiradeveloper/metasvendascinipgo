const mongoose = require('mongoose');

const feriadoSchema = new mongoose.Schema(
  {
    data: { type: String, required: true, unique: true, trim: true },
    nome: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feriado', feriadoSchema);