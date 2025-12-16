import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  nome: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});
categorySchema.index({ userId:1, nome:1 }, { unique:true });

export default mongoose.model('Category', categorySchema);
