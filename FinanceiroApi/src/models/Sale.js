import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', index:true, required:true },
  descricao: { type:String, required:true, trim:true },
  observacoes: { type:String, default:'' },
  valor: { type:Number, required:true, min:0 },
  dataVenda: { type:String, required:true },
  canal: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesChannel', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

saleSchema.index({ userId:1, dataVenda:1 });

saleSchema.pre('save', function(next){ this.updatedAt = new Date(); next(); });

export default mongoose.model('Sale', saleSchema);
