const mongoose = require('mongoose');

const deviceActivationSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true
  },
  paymentId: {
    type: String,
    default: null,
    index: true
  },
  paymentStatus: {
    type: String,
    default: 'not_created'
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
    default: null
  },
  deviceToken: {
    type: String,
    sparse: true,
    unique: true,
    index: true
  },
  activated: {
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

module.exports = mongoose.model('DeviceActivation', deviceActivationSchema);
