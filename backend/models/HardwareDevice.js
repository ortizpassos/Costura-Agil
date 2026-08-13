const mongoose = require('mongoose');

const hardwareDeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true
  },

  deviceType: {
    type: String,
    enum: [
      'producao',
      'revisao_rfid',
      'cadastro_rfid'
    ],
    required: true,
    index: true
  },

  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline',
    index: true
  },

  firmwareVersion: {
    type: String,
    default: ''
  },

  ipAddress: {
    type: String,
    default: ''
  },

  linkedDeviceToken: {
    type: String,
    default: '',
    index: true
  },

  lastSeenAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('HardwareDevice', hardwareDeviceSchema);
