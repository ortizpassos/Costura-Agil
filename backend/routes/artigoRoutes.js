const express = require('express');
const router = express.Router();
const Artigo = require('../models/Artigo');
const RFIDTag = require('../models/RFIDTag');
const Dispositivo = require('../models/Dispositivo');
const { autenticar } = require('./authRoutes');

let io = null;
function setSocketIO(socketIO) { io = socketIO; }

async function notificarArtigosNormais(usuarioId) {
  if (!io) return;

  const dispositivos = await Dispositivo.find({ usuario: usuarioId });
  const artigos = await Artigo.find({
    criadoPor: usuarioId,
    status: 'em_producao'
  }).sort({ nome: 1 });

  // IMPORTANTE: sem filtro RFID. Mantém o Esp32-Dispositivo antigo.
  dispositivos.forEach(dispositivo => {
    io.emit('artigosAtualizados', {
      data: {
        deviceToken: dispositivo.deviceToken,
        artigos: artigos.map(art => ({
          _id: art._id,
          nome: art.nome,
          codigo: art.codigo,
          quantidade: art.quantidade,
          quantidadeAtual: art.quantidadeAtual || 0,
          status: art.status
        }))
      }
    });
  });
}

router.get('/', autenticar, async (req, res) => {
  try {
    const artigos = await Artigo.find({ criadoPor: req.usuario.id })
      .sort({ dataInclusao: -1 });
    res.json(artigos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', autenticar, async (req, res) => {
  try {
    const rfidEnabled = req.body.rfidEnabled === true;

    const artigo = new Artigo({
      codigo: req.body.codigo,
      nome: req.body.nome,
      operacao: req.body.operacao,
      cliente: req.body.cliente,
      dataInclusao: req.body.dataInclusao || new Date(),
      valor: req.body.valor,
      quantidade: req.body.quantidade,
      status: req.body.status || 'pendente',
      rfidEnabled,
      rfidScanStatus: rfidEnabled ? 'aguardando' : 'nao_aplicavel',
      rfidTagsCount: 0,
      criadoPor: req.usuario.id
    });

    await artigo.save();

    if (artigo.status === 'em_producao') {
      await notificarArtigosNormais(req.usuario.id);
    }

    res.status(201).json(artigo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', autenticar, async (req, res) => {
  try {
    const artigo = await Artigo.findOne({
      _id: req.params.id,
      criadoPor: req.usuario.id
    });

    if (!artigo) return res.status(404).json({ message: 'Artigo não encontrado' });

    const statusAnterior = artigo.status;
    const rfidAnterior = artigo.rfidEnabled === true;

    const campos = [
      'codigo', 'nome', 'operacao', 'cliente', 'dataInclusao',
      'valor', 'quantidade', 'quantidadeAtual', 'status'
    ];

    for (const campo of campos) {
      if (req.body[campo] !== undefined) artigo[campo] = req.body[campo];
    }

    if (req.body.rfidEnabled !== undefined) {
      artigo.rfidEnabled = req.body.rfidEnabled === true;

      if (!artigo.rfidEnabled) {
        await RFIDTag.deleteMany({ artigo: artigo._id });
        artigo.rfidTagsCount = 0;
        artigo.rfidScanStatus = 'nao_aplicavel';
        artigo.rfidScanStartedAt = null;
        artigo.rfidScanFinishedAt = null;
      } else if (!rfidAnterior) {
        artigo.rfidScanStatus = 'aguardando';
      }
    }

    if (artigo.rfidEnabled && artigo.rfidTagsCount !== artigo.quantidade) {
      artigo.rfidScanStatus = 'aguardando';
    }

    await artigo.save();

    if (statusAnterior !== artigo.status || rfidAnterior !== artigo.rfidEnabled) {
      await notificarArtigosNormais(artigo.criadoPor);
    }

    res.json(artigo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', autenticar, async (req, res) => {
  try {
    const artigo = await Artigo.findOneAndDelete({
      _id: req.params.id,
      criadoPor: req.usuario.id
    });

    if (!artigo) return res.status(404).json({ message: 'Artigo não encontrado' });

    await RFIDTag.deleteMany({ artigo: artigo._id });
    res.json({ message: 'Artigo removido com sucesso' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = { router, setSocketIO };
