const mongoose = require('mongoose');

const producaoDetalhadaSchema = new mongoose.Schema({
  operacao: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operacao',
    required: true
  },
  funcionario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Funcionario',
    required: true
  },
  dispositivo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dispositivo',
    required: true
  },
  quantidade: {
    type: Number,
    required: true,
    default: 0
  },
  tempoProducao: {
    type: Number,
    required: false
  }
}, {
  timestamps: true
});

const ProducaoDetalhada = mongoose.model('ProducaoDetalhada', producaoDetalhadaSchema);

module.exports = ProducaoDetalhada;
