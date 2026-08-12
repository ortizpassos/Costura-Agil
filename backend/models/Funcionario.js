const mongoose = require('mongoose');

const funcionarioSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  nome: {
    type: String,
    required: true,
    trim: true
  },
  codigo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  funcao: {
    type: String,
    required: true,
    trim: true
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Funcionario', funcionarioSchema);

