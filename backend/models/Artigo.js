const mongoose = require('mongoose');

const artigoSchema = new mongoose.Schema({
  codigo: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  nome: {
    type: String,
    required: true,
    trim: true
  },
  operacao: {
    type: String,
    required: true,
    trim: true
  },
  cliente: {
    type: String,
    required: true,
    trim: true
  },
  dataInclusao: {
    type: Date,
    required: true,
    default: Date.now
  },
  valor: {
    type: Number,
    required: true,
    min: 0
  },
  quantidade: {
    type: Number,
    required: true,
    min: 0
  },
  quantidadeAtual: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pendente', 'em_producao', 'pausado', 'finalizado'],
    default: 'pendente'
  },
  criadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: false
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
