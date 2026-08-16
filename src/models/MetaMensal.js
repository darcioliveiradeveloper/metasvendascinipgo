const mongoose = require('mongoose');

const metaSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    anoMes: { type: String, required: true },
    meta: { type: Number, default: 0 },
    fechado: { type: Boolean, default: false },
    fechadoEm: Date
  },
  { timestamps: true }
);

metaSchema.index({ usuario: 1, anoMes: 1 }, { unique: true });

module.exports = mongoose.model('MetaMensal', metaSchema);
