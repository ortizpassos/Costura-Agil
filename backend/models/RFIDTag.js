const mongoose = require('mongoose');

const rfidTagSchema = new mongoose.Schema({
  epc: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true
  },

  artigo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artigo',
    required: true,
    index: true
  },

  revisada: {
    type: Boolean,
    default: false,
    index: true
  },

  revisadaEm: {
    type: Date,
    default: null
  },

  dispositivoRevisao: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

rfidTagSchema.index({ artigo: 1, revisada: 1 });

module.exports = mongoose.model('RFIDTag', rfidTagSchema);
