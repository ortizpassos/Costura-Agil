const express = require("express");
const router = express.Router();
const Funcionario = require("../models/Funcionario");
const { autenticar } = require("./authRoutes");

// Aplicar middleware em todas as rotas
router.use(autenticar);

// Criar novo funcionário
router.post("/", async (req, res) => {
  try {
    const funcionarioData = { ...req.body, usuario: req.usuario.id };
    const novoFuncionario = new Funcionario(funcionarioData);
    await novoFuncionario.save();
    res.status(201).json(novoFuncionario);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Obter todos os funcionários (do usuário logado)
router.get("/", async (req, res) => {
  try {
    const funcionarios = await Funcionario.find({ usuario: req.usuario.id });
    res.json(funcionarios);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Obter funcionário por ID
router.get("/:id", async (req, res) => {
  try {
    const funcionario = await Funcionario.findById(req.params.id);
    if (!funcionario) return res.status(404).json({ message: "Funcionário não encontrado" });
    res.json(funcionario);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Atualizar funcionário
router.patch("/:id", async (req, res) => {
  try {
    const funcionario = await Funcionario.findById(req.params.id);
    if (!funcionario) return res.status(404).json({ message: "Funcionário não encontrado" });

    Object.assign(funcionario, req.body);
    await funcionario.save();
    res.json(funcionario);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Deletar funcionário
router.delete("/:id", async (req, res) => {
  try {
    const funcionario = await Funcionario.findById(req.params.id);
    if (!funcionario) return res.status(404).json({ message: "Funcionário não encontrado" });

    await Funcionario.deleteOne({ _id: req.params.id });
    res.json({ message: "Funcionário deletado" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

