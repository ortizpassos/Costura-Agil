const express = require('express');
const router = express.Router();
const Artigo = require('../models/Artigo');
const Dispositivo = require('../models/Dispositivo');
const { autenticar } = require('./authRoutes');

// Variável para armazenar a instância do Socket.IO
let io = null;

// Função para configurar o Socket.IO
function setSocketIO(socketIO) {
  io = socketIO;
}

// GET /api/artigos - lista todos os artigos
router.get('/', autenticar, async (req, res) => {
  try {
    const artigos = await Artigo.find().sort({ dataInclusao: -1 });
    res.json(artigos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/artigos - cadastra novo artigo
router.post('/', autenticar, async (req, res) => {
  try {
    const artigo = new Artigo({
      codigo: req.body.codigo,
      nome: req.body.nome,
      operacao: req.body.operacao,
      cliente: req.body.cliente,
      dataInclusao: req.body.dataInclusao || new Date(),
      valor: req.body.valor,
      quantidade: req.body.quantidade,
      status: req.body.status || 'pendente',
      criadoPor: req.usuario.id
    });
    await artigo.save();
    
    // Se o novo artigo foi criado com status 'em_producao', notificar dispositivos
    if (artigo.status === 'em_producao' && io) {
      console.log(`🆕 Novo artigo em produção criado: ${artigo.nome}`);
      
      // Buscar dispositivos vinculados ao usuário
      const dispositivos = await Dispositivo.find({ usuario: req.usuario.id });
      
      // Buscar todos os artigos em produção deste usuário
      const artigosEmProducao = await Artigo.find({ 
        criadoPor: req.usuario.id, 
        status: 'em_producao'
      }).sort({ nome: 1 });
      
      // Notificar cada dispositivo do usuário
      dispositivos.forEach(dispositivo => {
        io.emit('artigosAtualizados', {
          data: {
            deviceToken: dispositivo.deviceToken,
            artigos: artigosEmProducao.map(art => ({
              _id: art._id,
              nome: art.nome,
              codigo: art.codigo,
              quantidade: art.quantidade,
              quantidadeAtual: art.quantidadeAtual || 0,
              status: art.status
            }))
          }
        });
        
        console.log(`📡 Notificado dispositivo ${dispositivo.deviceToken} sobre novo artigo`);
      });
    }
    
    res.status(201).json(artigo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/artigos/:id - atualiza um artigo existente
router.put('/:id', autenticar, async (req, res) => {
  try {
    // Buscar artigo atual antes da atualização para verificar mudança de status
    const artigoAnterior = await Artigo.findById(req.params.id);
    
    if (!artigoAnterior) {
      return res.status(404).json({ message: 'Artigo não encontrado' });
    }
    
    const statusAnterior = artigoAnterior.status;
    const novoStatus = req.body.status || statusAnterior;
    
    const artigoAtualizado = await Artigo.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          codigo: req.body.codigo,
          nome: req.body.nome,
          operacao: req.body.operacao,
          cliente: req.body.cliente,
          dataInclusao: req.body.dataInclusao,
          valor: req.body.valor,
          quantidade: req.body.quantidade,
          quantidadeAtual: req.body.quantidadeAtual,
          status: novoStatus
        }
      },
      { new: true, runValidators: true }
    );

    // Se o status mudou, notificar dispositivos em tempo real
    if (statusAnterior !== novoStatus && io) {
      console.log(`🔄 Status do artigo ${artigoAtualizado.nome} mudou de ${statusAnterior} → ${novoStatus}`);
      
      // Buscar dispositivos vinculados ao usuário deste artigo
      const dispositivos = await Dispositivo.find({ usuario: artigoAnterior.criadoPor });
      
      // Buscar artigos em produção deste usuário
      const artigosEmProducao = await Artigo.find({ 
        criadoPor: artigoAnterior.criadoPor, 
        status: 'em_producao'
      }).sort({ nome: 1 });
      
      // Notificar cada dispositivo do usuário
      dispositivos.forEach(dispositivo => {
        io.emit('artigosAtualizados', {
          data: {
            deviceToken: dispositivo.deviceToken,
            artigos: artigosEmProducao.map(art => ({
              _id: art._id,
              nome: art.nome,
              codigo: art.codigo,
              quantidade: art.quantidade,
              quantidadeAtual: art.quantidadeAtual || 0,
              status: art.status
            }))
          }
        });
        
        console.log(`📡 Notificado dispositivo ${dispositivo.deviceToken} sobre mudança de status`);
      });
    }

    res.json(artigoAtualizado);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/artigos/:id - remove um artigo
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const artigo = await Artigo.findByIdAndDelete(req.params.id);
    if (!artigo) {
      return res.status(404).json({ message: 'Artigo não encontrado' });
    }
    res.json({ message: 'Artigo removido com sucesso' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = { router, setSocketIO };
