const mongoose = require('mongoose');

const provisioningActivationSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },

  deviceId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true
  },

  deviceType: {
    type: String,
    enum: [
      'producao',
      'revisao_rfid',
      'cadastro_rfid'
    ],
    required: true
  },

  nome: {
    type: String,
    default: ''
  },

  paymentId: {
    type: String,
    default: '',
    index: true
  },

  paymentStatus: {
    type: String,
    default: 'not_created',
    index: true
  },

  amount: {
    type: Number,
    required: true
  },

  currency: {
    type: String,
    default: 'BRL'
  },

  qrCode: {
    type: String,
    default: ''
  },

  qrCodeBase64: {
    type: String,
    default: ''
  },

  licenseToken: {
    type: String,
    default: '',
    index: true
  },

  licenseCreated: {
    type: Boolean,
    default: false
  },

  hardwareLinked: {
    type: Boolean,
    default: false
  },

  paidAt: {
    type: Date,
    default: null
  },

  lastCheckedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

provisioningActivationSchema.index({
  usuario: 1,
  deviceId: 1,
  paymentStatus: 1
});

module.exports = mongoose.model(
  'ProvisioningActivation',
  provisioningActivationSchema
);
