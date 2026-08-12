const mongoose = require("mongoose");

const producaoSchema = new mongoose.Schema({
  funcionario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Funcionario",
    required: true,
  },
  dispositivo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Dispositivo",
    required: true,
  },
  operacao: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Operacao",
    default: null,
  },
  quantidade: {
    type: Number,
    required: true,
  },
  tempoProducao: {
    type: Number, // Tempo em segundos ou milissegundos
    required: true,
  },
  dataHora: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model("Producao", producaoSchema, "producao");

