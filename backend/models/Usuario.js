const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
}, { timestamps: true });

usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('senha')) return next();
  this.senha = await bcrypt.hash(this.senha, 10);
  next();
});

usuarioSchema.methods.validarSenha = function(senha) {
  return bcrypt.compare(senha, this.senha);
};

module.exports = mongoose.model('Usuario', usuarioSchema);
