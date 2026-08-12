const express = require("express");
const router = express.Router();
const Operacao = require("../models/Operacao");
const { autenticar } = require('./authRoutes');

// Criar nova operação
router.post("/", autenticar, async (req, res) => {
  try {
    console.log('POST /api/operacoes');
    console.log('req.body:', req.body);
    console.log('req.usuario:', req.usuario);
    const usuarioId = req.usuario?.id;
    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }
    const novaOperacao = new Operacao({ ...req.body, usuario: usuarioId });
    await novaOperacao.save();
    console.log('Operação criada:', novaOperacao);
    res.status(201).json(novaOperacao);
  } catch (err) {
    console.error('Erro ao criar operação:', err);
    res.status(400).json({ message: err.message });
  }
});

// Listar todas as operações do usuário
router.get("/", autenticar, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const operacoes = await Operacao.find({ usuario: usuarioId, ativo: true }).sort({ nome: 1 });
    res.json(operacoes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Buscar operação por ID
router.get("/:id", autenticar, async (req, res) => {
  try {
    const operacao = await Operacao.findById(req.params.id);
    if (!operacao) return res.status(404).json({ message: "Operação não encontrada" });
    res.json(operacao);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Atualizar operação
router.patch("/:id", autenticar, async (req, res) => {
  try {
    const operacao = await Operacao.findById(req.params.id);
    if (!operacao) return res.status(404).json({ message: "Operação não encontrada" });

    Object.assign(operacao, req.body);
    await operacao.save();
    res.json(operacao);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Deletar operação (soft delete - apenas desativa)
router.delete("/:id", autenticar, async (req, res) => {
  try {
    const operacao = await Operacao.findById(req.params.id);
    if (!operacao) return res.status(404).json({ message: "Operação não encontrada" });

    operacao.ativo = false;
    await operacao.save();
    res.json({ message: "Operação desativada" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
