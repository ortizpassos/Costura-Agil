const express = require('express');
const nfeMessagingService = require('../services/nfeMessagingService');
const router = express.Router();

// GET /api/nfe - List all NFe (mock for now, since Java service doesn't have list)
router.get('/', async (req, res) => {
  try {
    // TODO: Implementar listagem no serviço Java
    const mockNfe = [
      {
        numero: '0001',
        dataEmissao: '2025-12-16',
        cliente: 'Cliente Exemplo',
        valorTotal: 1000.00,
        status: 'Emitida'
      }
    ];
    res.json(mockNfe);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/nfe/status - Get NFe service status
router.get('/status', async (req, res) => {
  try {
    const response = await nfeMessagingService.getStatus();
    if (response.success) {
      res.json({ message: response.message });
    } else {
      res.status(500).json({ error: response.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar status do serviço NFe: ' + error.message });
  }
});

// POST /api/nfe/gerar - Generate NFe
router.post('/gerar', async (req, res) => {
  try {
    const { xml } = req.body;
    const response = await nfeMessagingService.gerarNfe(xml);
    if (response.success) {
      res.json({ result: response.message });
    } else {
      res.status(400).json({ error: response.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar NFe: ' + error.message });
  }
});

// POST /api/nfe - Create new NFe (mock)
router.post('/', async (req, res) => {
  try {
    const { numero, dataEmissao, cliente, valorTotal, status } = req.body;
    // Mock response
    const newNfe = { numero, dataEmissao, cliente, valorTotal, status, id: Date.now() };
    res.status(201).json(newNfe);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/nfe/:id - Update NFe (mock)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    // Mock response
    res.json({ id, ...updates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/nfe/:id - Delete NFe (mock)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Mock response
    res.json({ message: 'NFe deleted', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/nfe/consultar - Consult NFe
router.post('/consultar', async (req, res) => {
  try {
    const { chave } = req.body;
    const response = await nfeMessagingService.consultarNfe(chave);
    if (response.success) {
      res.json({ result: response.message });
    } else {
      res.status(400).json({ error: response.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar NFe: ' + error.message });
  }
});

// POST /api/nfe/cancelar - Cancel NFe
router.post('/cancelar', async (req, res) => {
  try {
    const { chave, justificativa } = req.body;
    const response = await nfeMessagingService.cancelarNfe(chave, justificativa);
    if (response.success) {
      res.json({ result: response.message });
    } else {
      res.status(400).json({ error: response.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cancelar NFe: ' + error.message });
  }
});

// POST /api/nfe/cce - Send Carta de Correção Eletrônica
router.post('/cce', async (req, res) => {
  try {
    const { chave, correcao } = req.body;
    const response = await nfeMessagingService.enviarCce(chave, correcao);
    if (response.success) {
      res.json({ result: response.message });
    } else {
      res.status(400).json({ error: response.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao enviar CC-e: ' + error.message });
  }
});

module.exports = router;