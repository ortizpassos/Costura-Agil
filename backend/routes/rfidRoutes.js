const express = require('express');
const router = express.Router();
const Artigo = require('../models/Artigo');
const RFIDTag = require('../models/RFIDTag');
const { autenticar } = require('./authRoutes');

function normalizarEpc(v) {
  return String(v || '').replace(/\s+/g, '').trim().toUpperCase();
}

router.get('/:id/rfid', autenticar, async (req, res) => {
  try {
    const artigo = await Artigo.findOne({
      _id: req.params.id,
      criadoPor: req.usuario.id
    });

    if (!artigo) return res.status(404).json({ message: 'Artigo não encontrado.' });

    const total = await RFIDTag.countDocuments({ artigo: artigo._id });
    const revisadas = await RFIDTag.countDocuments({ artigo: artigo._id, revisada: true });

    res.json({
      artigoId: artigo._id,
      codigo: artigo.codigo,
      nome: artigo.nome,
      quantidade: artigo.quantidade,
      rfidEnabled: artigo.rfidEnabled,
      rfidScanStatus: artigo.rfidScanStatus,
      etiquetasCadastradas: total,
      etiquetasRevisadas: revisadas,
      etiquetasPendentes: Math.max(0, total - revisadas)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/rfid/start', autenticar, async (req, res) => {
  try {
    const artigo = await Artigo.findOne({
      _id: req.params.id,
      criadoPor: req.usuario.id
    });

    if (!artigo) return res.status(404).json({ message: 'Artigo não encontrado.' });
    if (!artigo.rfidEnabled) return res.status(400).json({ message: 'Artigo cadastrado como Sem RFID.' });

    if (req.body.preservar !== true) {
      await RFIDTag.deleteMany({ artigo: artigo._id });
      artigo.rfidTagsCount = 0;
    }

    artigo.rfidScanStatus = 'em_leitura';
    artigo.rfidScanStartedAt = new Date();
    artigo.rfidScanFinishedAt = null;
    await artigo.save();

    res.json({
      success: true,
      artigoId: artigo._id,
      quantidade: artigo.quantidade,
      etiquetasCadastradas: artigo.rfidTagsCount
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Futuro dispositivo exclusivo de cadastro RFID usará esta rota.
// Antes de produção definitiva, autentique esse dispositivo com token próprio.
router.post('/:id/rfid/tag', async (req, res) => {
  try {
    const artigo = await Artigo.findById(req.params.id);
    if (!artigo) return res.status(404).json({ success: false, message: 'Artigo não encontrado.' });
    if (!artigo.rfidEnabled) return res.status(400).json({ success: false, message: 'Artigo sem RFID.' });
    if (artigo.rfidScanStatus !== 'em_leitura') {
      return res.status(409).json({ success: false, message: 'Sessão RFID não está em leitura.' });
    }

    const epc = normalizarEpc(req.body.epc);
    if (!epc) return res.status(400).json({ success: false, message: 'EPC não informado.' });

    const existente = await RFIDTag.findOne({ epc });
    if (existente) {
      if (String(existente.artigo) === String(artigo._id)) {
        return res.json({
          success: true,
          duplicate: true,
          message: 'EPC já cadastrado neste artigo.',
          epc,
          etiquetasCadastradas: artigo.rfidTagsCount,
          quantidade: artigo.quantidade
        });
      }

      return res.status(409).json({
        success: false,
        duplicate: true,
        message: 'EPC já pertence a outro artigo.',
        epc
      });
    }

    if (artigo.rfidTagsCount >= artigo.quantidade) {
      return res.status(409).json({
        success: false,
        message: 'Quantidade de EPCs já atingiu a quantidade de peças do artigo.'
      });
    }

    await RFIDTag.create({ epc, artigo: artigo._id });
    artigo.rfidTagsCount += 1;

    if (artigo.rfidTagsCount === artigo.quantidade) {
      artigo.rfidScanStatus = 'concluido';
      artigo.rfidScanFinishedAt = new Date();
    }

    await artigo.save();

    res.json({
      success: true,
      duplicate: false,
      epc,
      etiquetasCadastradas: artigo.rfidTagsCount,
      quantidade: artigo.quantidade,
      concluido: artigo.rfidTagsCount === artigo.quantidade
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, duplicate: true, message: 'EPC duplicado.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id/rfid/tag/:epc', autenticar, async (req, res) => {
  try {
    const artigo = await Artigo.findOne({
      _id: req.params.id,
      criadoPor: req.usuario.id
    });

    if (!artigo) return res.status(404).json({ message: 'Artigo não encontrado.' });

    const epc = normalizarEpc(req.params.epc);
    const removido = await RFIDTag.findOneAndDelete({ epc, artigo: artigo._id });

    artigo.rfidTagsCount = await RFIDTag.countDocuments({ artigo: artigo._id });
    artigo.rfidScanStatus = artigo.rfidTagsCount === artigo.quantidade ? 'concluido' : 'aguardando';
    await artigo.save();

    res.json({ success: true, removido: !!removido, etiquetasCadastradas: artigo.rfidTagsCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/rfid/finish', autenticar, async (req, res) => {
  try {
    const artigo = await Artigo.findOne({
      _id: req.params.id,
      criadoPor: req.usuario.id
    });

    if (!artigo) return res.status(404).json({ message: 'Artigo não encontrado.' });
    if (!artigo.rfidEnabled) return res.status(400).json({ message: 'Artigo sem RFID.' });

    const total = await RFIDTag.countDocuments({ artigo: artigo._id });
    artigo.rfidTagsCount = total;

    if (total !== artigo.quantidade) {
      artigo.rfidScanStatus = 'aguardando';
      await artigo.save();
      return res.status(409).json({
        success: false,
        message: `É necessário cadastrar exatamente ${artigo.quantidade} EPCs. Atualmente: ${total}.`,
        etiquetasCadastradas: total,
        quantidade: artigo.quantidade
      });
    }

    artigo.rfidScanStatus = 'concluido';
    artigo.rfidScanFinishedAt = new Date();
    await artigo.save();

    res.json({
      success: true,
      message: 'Cadastro RFID concluído.',
      etiquetasCadastradas: total,
      quantidade: artigo.quantidade
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
