const express = require('express');
const router = express.Router();
const Dispositivo = require('../models/Dispositivo');
const Funcionario = require('../models/Funcionario');
const { autenticar } = require('./authRoutes');

// GET /api/relatorios - busca relatórios filtrados e agrupados por funcionário, artigo e dia
router.get('/', autenticar, async (req, res) => {
  try {
    const ProducaoDetalhada = require('../models/ProducaoDetalhada');
    const { dataInicio, dataFim, funcionario, artigo } = req.query;
    const dispositivos = await Dispositivo.find({ usuario: req.usuario.id });
    const filtro = {
      dispositivo: { $in: dispositivos.map(d => d._id) }
    };
    
    // Filtro por data usando createdAt (timestamp da produção)
    if (dataInicio || dataFim) {
      filtro.createdAt = {};
      if (dataInicio) filtro.createdAt.$gte = new Date(dataInicio);
      if (dataFim) filtro.createdAt.$lte = new Date(dataFim + 'T23:59:59');
    }
    
    // Filtro por funcionário
    if (funcionario) {
      const funcionarios = await Funcionario.find({ 
        nome: { $regex: funcionario, $options: 'i' } 
      });
      filtro.funcionario = { $in: funcionarios.map(f => f._id) };
    }
    
    // Filtro por artigo
    if (artigo) {
      const Artigo = require('../models/Artigo');
      const artigos = await Artigo.find({
        $or: [
          { nome: { $regex: artigo, $options: 'i' } },
          { codigo: { $regex: artigo, $options: 'i' } }
        ]
      });
      filtro.artigo = { $in: artigos.map(a => a._id) };
    }
    
    // Agregação para agrupar por funcionário, artigo e dia
    const relatorios = await ProducaoDetalhada.aggregate([
      { $match: filtro },
      {
        $lookup: {
          from: 'funcionarios',
          localField: 'funcionario',
          foreignField: '_id',
          as: 'funcionarioData'
        }
      },
      {
        $lookup: {
          from: 'artigos',
          localField: 'artigo',
          foreignField: '_id',
          as: 'artigoData'
        }
      },
      { $unwind: { path: '$funcionarioData', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$artigoData', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          dia: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'America/Sao_Paulo' } },
          funcionario: '$funcionarioData.nome',
          funcionarioId: '$funcionario',
          artigo: '$artigoData.nome',
          artigoCodigo: '$artigoData.codigo',
          artigoId: '$artigo',
          quantidade: 1,
          tempoProducao: 1
        }
      },
      {
        $group: {
          _id: {
            dia: '$dia',
            funcionarioId: '$funcionarioId',
            funcionario: '$funcionario',
            artigoId: '$artigoId',
            artigo: '$artigo',
            artigoCodigo: '$artigoCodigo'
          },
          totalProducao: { $sum: '$quantidade' },
          totalTempo: { $sum: '$tempoProducao' }
        }
      },
      {
        $project: {
          _id: 0,
          dia: '$_id.dia',
          funcionario: '$_id.funcionario',
          artigo: '$_id.artigo',
          artigoCodigo: '$_id.artigoCodigo',
          totalProducao: 1,
          totalTempo: 1
        }
      },
      { $sort: { dia: -1, funcionario: 1, artigo: 1 } }
    ]);
    
    console.log('Relatórios agrupados:', relatorios.length);
    res.json(relatorios);
  } catch (err) {
    console.error('Erro ao buscar relatórios:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/relatorios/estatisticas - retorna estatísticas gerais
router.get('/estatisticas', autenticar, async (req, res) => {
  try {
    const ProducaoDetalhada = require('../models/ProducaoDetalhada');
    const { dataInicio, dataFim } = req.query;
    
    const dispositivos = await Dispositivo.find({ usuario: req.usuario.id });
    const filtro = { dispositivo: { $in: dispositivos.map(d => d._id) } };
    
    if (dataInicio || dataFim) {
      filtro.createdAt = {};
      if (dataInicio) filtro.createdAt.$gte = new Date(dataInicio);
      if (dataFim) filtro.createdAt.$lte = new Date(dataFim + 'T23:59:59');
    }
    
    const producoes = await ProducaoDetalhada.find(filtro).populate('artigo funcionario');
    const totalProducao = producoes.reduce((acc, p) => acc + (p.quantidade || 0), 0);
    const funcionariosUnicos = new Set(producoes.map(p => p.funcionario?._id?.toString()).filter(Boolean)).size;
    const artigosUnicos = new Set(producoes.map(p => p.artigo?._id?.toString()).filter(Boolean)).size;
    
    // Calcular percentual atingido baseado nas metas dos artigos
    const Artigo = require('../models/Artigo');
    const artigosEmProducao = await Artigo.find({ 
      criadoPor: req.usuario.id, 
      status: 'em_producao' 
    });
    const metaTotal = artigosEmProducao.reduce((acc, art) => acc + (art.quantidade || 0), 0);
    const producaoAtual = artigosEmProducao.reduce((acc, art) => acc + (art.quantidadeAtual || 0), 0);
    const percentualAtingido = metaTotal > 0 ? Math.round((producaoAtual / metaTotal) * 100) : 0;
    
    res.json({
      totalProducao,
      funcionariosAtivos: funcionariosUnicos,
      artigosEmProducao: artigosUnicos,
      percentualAtingido
    });
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
