import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Account from '../models/Account.js';

const router = Router();
router.use(auth);

// GET /api/accounts - Listar contas do usuário
router.get('/', async (req, res, next) => {
  try {
    const accounts = await Account.find({ userId: req.user.id, ativo: true })
      .sort({ nome: 1 });
    res.json(accounts);
  } catch (e) { next(e); }
});

// POST /api/accounts - Criar nova conta
router.post('/', async (req, res, next) => {
  try {
    const { nome, tipo, saldoInicial } = req.body;

    if (!nome || nome.trim().length < 2) {
      return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres' });
    }

    // Verificar se já existe uma conta com o mesmo nome
    const existing = await Account.findOne({
      userId: req.user.id,
      nome: nome.trim(),
      ativo: true
    });

    if (existing) {
      return res.status(400).json({ error: 'Conta com este nome já existe' });
    }

    const account = await Account.create({
      userId: req.user.id,
      nome: nome.trim(),
      tipo: tipo || 'banco',
      saldoInicial: parseFloat(saldoInicial) || 0
    });

    res.status(201).json(account);
  } catch (e) { next(e); }
});

// PUT /api/accounts/:id - Atualizar conta
router.put('/:id', async (req, res, next) => {
  try {
    const { nome, tipo, saldoInicial } = req.body;

    if (!nome || nome.trim().length < 2) {
      return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres' });
    }

    const updateData = {
      nome: nome.trim(),
      tipo: tipo || 'banco'
    };

    // Só permite alterar saldo inicial se não houver transações
    // Por enquanto, vamos permitir alteração
    if (saldoInicial !== undefined) {
      updateData.saldoInicial = parseFloat(saldoInicial) || 0;
    }

    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, ativo: true },
      updateData,
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    res.json(account);
  } catch (e) { next(e); }
});

// DELETE /api/accounts/:id - Desativar conta (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, ativo: true },
      { ativo: false },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PUT /api/accounts/:id/balance - Atualizar saldo atual
router.put('/:id/balance', async (req, res, next) => {
  try {
    const { saldoAtual } = req.body;

    if (saldoAtual === undefined || isNaN(parseFloat(saldoAtual))) {
      return res.status(400).json({ error: 'Saldo atual é obrigatório' });
    }

    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, ativo: true },
      { saldoAtual: parseFloat(saldoAtual) },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    res.json(account);
  } catch (e) { next(e); }
});

export default router;