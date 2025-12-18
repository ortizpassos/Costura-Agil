import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Supplier from '../models/Supplier.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const list = await Supplier.find({ userId: req.user.id }).sort({ nome: 1 });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { nome, contato, telefone, email } = req.body || {};
    if (!nome) {
      return res.status(400).json({ error: 'nome obrigatório' });
    }
    const supplier = await Supplier.create({ userId: req.user.id, nome, contato, telefone, email });
    res.status(201).json(supplier);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Fornecedor duplicado' });
    }
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const updated = await Supplier.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Não encontrado' });
    }
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Supplier.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
