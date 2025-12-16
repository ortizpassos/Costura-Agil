import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', index:true, required:true },
  descricao: { type:String, required:true, trim:true },
  observacoes: { type:String, default:'' },
  valor: { type:Number, required:true, min:0 },
  dataCompra: { type:String, required:true }, // ISO date (YYYY-MM-DD)
  dataVencimento: { type:String, required:true },
  dataPagamento: { type:String, default:'' },
  categoria: { type:String, default:'' },
  fornecedor: { type:String, default:'' },
  formaPagamento: { type:String, default:'' },
  valorPago: { type:Number, default:0 },
  pago: { type:Boolean, default:false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

expenseSchema.index({ userId:1, dataVencimento:1 });

expenseSchema.pre('save', function(next){ this.updatedAt = new Date(); next(); });

export default mongoose.model('Expense', expenseSchema);
