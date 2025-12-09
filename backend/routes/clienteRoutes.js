const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente');
const { autenticar } = require('./authRoutes');

router.get('/', autenticar, async (req, res) => {
  try {
    const clientes = await Cliente.find().sort({ nome: 1 });
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', autenticar, async (req, res) => {
  try {
    const cliente = new Cliente({
      nome: req.body.nome,
      contato: req.body.contato,
      criadoPor: req.usuario.id
    });
    await cliente.save();
    res.status(201).json(cliente);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
