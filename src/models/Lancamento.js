const mongoose = require('mongoose');

const lancamentoSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    anoMes: { type: String, required: true },
    data: { type: Date, required: true },
    total: { type: Number, required: true }
  },
  { timestamps: true }
);

lancamentoSchema.index({ usuario: 1, anoMes: 1, data: -1 });

module.exports = mongoose.model('Lancamento', lancamentoSchema);
