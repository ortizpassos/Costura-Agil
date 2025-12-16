import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', index:true, required:true },
  descricao: { type:String, required:true, trim:true },
  observacoes: { type:String, default:'' },
  valor: { type:Number, required:true, min:0 },
  dataRecebimento: { type:String, required:true },
  formaRecebimento: { type:String, default:'' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
receiptSchema.index({ userId:1, dataRecebimento:1 });
receiptSchema.pre('save', function(next){ this.updatedAt = new Date(); next(); });

export default mongoose.model('Receipt', receiptSchema);
