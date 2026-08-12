const express = require('express');
const router = express.Router();
const Dispositivo = require('../models/Dispositivo');

// Rota para cadastrar dispositivo de teste ESP32_PRODUCAO_001
router.post('/cadastrar-teste', async (req, res) => {
  try {
    const deviceToken = 'ESP32_PRODUCAO_001';
    let dispositivo = await Dispositivo.findOne({ deviceToken });
    if (dispositivo) {
      return res.status(200).json({ message: 'Dispositivo já cadastrado', dispositivo });
    }
    dispositivo = new Dispositivo({
      deviceToken,
      nome: 'Dispositivo de Teste ESP32',
      metaDiaria: 100,
      operacao: 'costura',
      setor: 'produção',
      status: 'offline',
      producaoAtual: 0
    });
    await dispositivo.save();
    res.status(201).json({ message: 'Dispositivo cadastrado com sucesso', dispositivo });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao cadastrar dispositivo', error: err.message });
  }
});

module.exports = router;
