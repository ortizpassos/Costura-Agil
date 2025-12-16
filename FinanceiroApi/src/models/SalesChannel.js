import mongoose from 'mongoose';

const salesChannelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', index:true, required:true },
  nome: { type:String, required:true, trim:true, unique:true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

salesChannelSchema.index({ userId:1, nome:1 });

salesChannelSchema.pre('save', function(next){
  this.nome = this.nome.toUpperCase();
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('SalesChannel', salesChannelSchema);