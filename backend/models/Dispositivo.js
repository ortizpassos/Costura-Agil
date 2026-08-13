const mongoose = require("mongoose");

const hardwareHistorySchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  linkedAt: {
    type: Date,
    default: Date.now
  },
  unlinkedAt: {
    type: Date,
    default: null
  },
  reason: {
    type: String,
    default: ''
  }
}, { _id: false });

const dispositivoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },

  // LICENÇA PERMANENTE.
  // Continua único globalmente como já era no projeto.
  deviceToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },

  // Função da licença.
  deviceType: {
    type: String,
    enum: [
      'producao',
      'revisao_rfid',
      'cadastro_rfid'
    ],
    default: 'producao',
    index: true
  },

  // Hardware físico atualmente usando esta licença.
  // Não usamos "default: null" para o índice sparse não indexar
  // vários valores nulos.
  hardwareDeviceId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    trim: true,
    uppercase: true
  },

  hardwareLinkedAt: {
    type: Date,
    default: null
  },

  hardwareHistory: {
    type: [hardwareHistorySchema],
    default: []
  },

  activated: {
    type: Boolean,
    default: true
  },

  activationPaid: {
    type: Boolean,
    default: false
  },

  activationPaymentId: {
    type: String,
    default: null
  },

  nome: {
    type: String,
    required: true,
    trim: true
  },

  operacao: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operacao',
    default: null
  },

  artigo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artigo',
    default: null
  },

  setor: {
    type: String,
    trim: true,
    default: ''
  },

  status: {
    type: String,
    enum: ["online", "offline", "ocioso", "em_producao"],
    default: "offline"
  },

  funcionarioLogado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Funcionario",
    default: null
  },

  producaoAtual: {
    type: Number,
    default: 0
  },

  ultimaAtualizacao: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model("Dispositivo", dispositivoSchema);
