const express = require('express');
const router = express.Router();
const Producao = require('../models/Producao');
const Dispositivo = require('../models/Dispositivo');
const { autenticar } = require('./authRoutes');

// GET /api/producao - retorna dados de produção dos dispositivos do usuário
router.get('/', autenticar, async (req, res) => {
  try {
    // Buscar dispositivos do usuário autenticado
    const dispositivos = await Dispositivo.find({ usuario: req.usuario.id });
    
    // Criar histórico de produção dos últimos 7 dias baseado em producaoAtual
    const hoje = new Date();
    const producaoPorDia = [];
    
    for (let i = 6; i >= 0; i--) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() - i);
      data.setHours(0, 0, 0, 0);
      
      // Buscar produção desse dia na coleção Producao (se houver registros)
      const producaoDia = await Producao.find({
        dispositivo: { $in: dispositivos.map(d => d._id) },
        dataHora: {
          $gte: data,
          $lt: new Date(data.getTime() + 24 * 60 * 60 * 1000)
        }
      });
      
      const quantidadeTotal = producaoDia.reduce((acc, p) => acc + (p.quantidade || 0), 0);
      
      producaoPorDia.push({
        dataHora: data,
        quantidade: quantidadeTotal
      });
    }
    
    // Se não houver dados históricos, usar producaoAtual de cada dispositivo para hoje
    const ultimoDia = producaoPorDia[producaoPorDia.length - 1];
    if (ultimoDia.quantidade === 0) {
      ultimoDia.quantidade = dispositivos.reduce((acc, d) => acc + (d.producaoAtual || 0), 0);
    }
    
    res.json(producaoPorDia);
  } catch (err) {
    console.error('Erro ao buscar produção:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
