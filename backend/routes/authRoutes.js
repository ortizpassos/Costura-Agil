const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_super_secreto';

// Cadastro
// Cadastro adaptado para aceitar campos extras (codigo, funcao, etc)
router.post('/cadastro', async (req, res) => {
  try {
    // Aceita campos extras, mas só salva os definidos no schema
    const { nome, email, senha, codigo, funcao } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ message: 'Campos obrigatórios ausentes: nome, email, senha' });
    }
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) return res.status(400).json({ message: 'Email já cadastrado' });
    // Cria usuário, campos extras são ignorados pelo schema
    const novoUsuario = new Usuario({ nome, email, senha });
    await novoUsuario.save();
    res.status(201).json({ message: 'Usuário cadastrado com sucesso' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Login
// Login padronizado para resposta compatível com frontend
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    // Verificação para usuário admin fixo
    if (email === 'Admin' && senha === 'Rexc180523knd!') {
      const token = jwt.sign({ id: 'admin', email: 'Admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
      return res.json({
        success: true,
        data: {
          user: { id: 'admin', nome: 'Administrador', email: 'Admin', role: 'admin' },
          token,
          expiresIn: 86400 // 1 dia em segundos
        }
      });
    }
    
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ success: false, error: { message: 'Usuário não encontrado' } });
    }
    const senhaValida = await usuario.validarSenha(senha);
    if (!senhaValida) {
      return res.status(401).json({ success: false, error: { message: 'Senha incorreta' } });
    }
    const token = jwt.sign({ id: usuario._id, email: usuario.email }, JWT_SECRET, { expiresIn: '1d' });
    res.json({
      success: true,
      data: {
        user: { id: usuario._id, nome: usuario.nome, email: usuario.email },
        token,
        expiresIn: 86400 // 1 dia em segundos
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Middleware de autenticação
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Token não fornecido' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token inválido' });
  }
}

// Exemplo de rota protegida
router.get('/perfil', autenticar, async (req, res) => {
  const usuario = await Usuario.findById(req.usuario.id).select('-senha');
  res.json(usuario);
});

module.exports = { router, autenticar };
