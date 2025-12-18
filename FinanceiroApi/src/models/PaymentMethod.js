import mongoose from 'mongoose';

const paymentMethodSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index:true, required:true },
  nome: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});
paymentMethodSchema.index({ userId:1, nome:1 }, { unique:true });

export default mongoose.model('PaymentMethod', paymentMethodSchema);
