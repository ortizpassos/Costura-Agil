import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  nome: { type: String, required: true, trim: true },
  tipo: { type: String, enum: ['banco', 'dinheiro', 'cartao', 'investimento'], default: 'banco' },
  saldoInicial: { type: Number, default: 0 },
  saldoAtual: { type: Number, default: 0 },
  ativo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

accountSchema.index({ userId: 1, nome: 1 });
accountSchema.index({ userId: 1, ativo: 1 });

accountSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  // Se é uma nova conta, o saldo atual deve começar com o saldo inicial
  if (this.isNew) {
    this.saldoAtual = this.saldoInicial;
  }
  next();
});

export default mongoose.model('Account', accountSchema);