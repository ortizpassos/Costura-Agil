import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  nome: { type: String, required: true, trim: true },
  contato: { type: String, default: '', trim: true },
  telefone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true },
  createdAt: { type: Date, default: Date.now }
});

supplierSchema.index({ userId: 1, nome: 1 }, { unique: true });

export default mongoose.model('Supplier', supplierSchema);
