const mongoose = require("mongoose");

const operacaoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  nome: {
    type: String,
    required: true,
    trim: true,
  },
  metaDiaria: {
    type: Number,
    required: true,
    default: 0,
  },
  quantidadeAtual: {
    type: Number,
    default: 0,
  },
  setor: {
    type: String,
    trim: true,
    default: '',
  },
  descricao: {
    type: String,
    trim: true,
    default: '',
  },
  ativo: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

module.exports = mongoose.model("Operacao", operacaoSchema, "operacoes");
