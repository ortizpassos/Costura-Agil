const mongoose = require('mongoose');

const artigoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, trim: true, unique: true },
  nome: { type: String, required: true, trim: true },
  operacao: { type: String, required: true, trim: true },
  cliente: { type: String, required: true, trim: true },
  dataInclusao: { type: Date, required: true, default: Date.now },
  valor: { type: Number, required: true, min: 0 },
  quantidade: { type: Number, required: true, min: 1 },
  quantidadeAtual: { type: Number, default: 0, min: 0 },

  status: {
    type: String,
    enum: ['pendente', 'em_producao', 'pausado', 'finalizado'],
    default: 'pendente'
  },

  rfidEnabled: {
    type: Boolean,
    default: false,
    index: true
  },

  rfidScanStatus: {
    type: String,
    enum: ['nao_aplicavel', 'aguardando', 'em_leitura', 'concluido'],
    default: 'nao_aplicavel',
    index: true
  },

  rfidTagsCount: {
    type: Number,
    default: 0,
    min: 0
  },

  rfidScanStartedAt: {
    type: Date,
    default: null
  },

  rfidScanFinishedAt: {
    type: Date,
    default: null
  },

  criadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },

  criadoEm: {
    type: Date,
    default: Date.now
  },

  dataInicioProducao: {
    type: Date,
    required: false
  },

  dataFimProducao: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Artigo', artigoSchema);
