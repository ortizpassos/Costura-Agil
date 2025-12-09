const mongoose = require("mongoose");

const dispositivoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  deviceToken: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  nome: {
    type: String,
    required: true,
    trim: true,
  },
  operacao: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operacao',
    default: null,
  },
  artigo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artigo',
    default: null,
  },
  setor: {
    type: String,
    trim: true,
    default: '',
  },
  status: {
    type: String,
    enum: ["online", "offline", "ocioso", "em_producao"],
    default: "offline",
  },
  funcionarioLogado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Funcionario",
    default: null,
  },
  producaoAtual: {
    type: Number,
    default: 0,
  },
  ultimaAtualizacao: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model("Dispositivo", dispositivoSchema);

