import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import SalesChannel from '../models/SalesChannel.js';

const router = Router();
router.use(auth);

// GET /api/sales-channels - Listar canais de venda do usuário
router.get('/', async (req,res,next)=>{ try {
  const list = await SalesChannel.find({ userId:req.user.id }).sort({ nome:1 });
  res.json(list);
} catch(e){ next(e); } });

// POST /api/sales-channels - Criar novo canal de venda
router.post('/', async (req,res,next)=>{ try {
  const { nome } = req.body;
  if(!nome || nome.trim().length < 2) {
    return res.status(400).json({error:'Nome deve ter pelo menos 2 caracteres'});
  }

  // Verificar se já existe
  const existing = await SalesChannel.findOne({
    userId: req.user.id,
    nome: nome.trim().toUpperCase()
  });

  if(existing) {
    return res.status(400).json({error:'Canal de venda duplicado'});
  }

  const item = await SalesChannel.create({
    userId: req.user.id,
    nome: nome.trim()
  });

  res.status(201).json(item);
} catch(e){ next(e);} });

// PUT /api/sales-channels/:id - Atualizar canal de venda
router.put('/:id', async (req,res,next)=>{ try {
  const { nome } = req.body;
  if(!nome || nome.trim().length < 2) {
    return res.status(400).json({error:'Nome deve ter pelo menos 2 caracteres'});
  }

  const upd = await SalesChannel.findOneAndUpdate(
    { _id:req.params.id, userId:req.user.id },
    { nome: nome.trim() },
    { new:true }
  );

  if(!upd) return res.status(404).json({error:'Canal de venda não encontrado'});
  res.json(upd);
} catch(e){ next(e);} });

// DELETE /api/sales-channels/:id - Excluir canal de venda
router.delete('/:id', async (req,res,next)=>{ try {
  const deleted = await SalesChannel.findOneAndDelete({
    _id:req.params.id,
    userId:req.user.id
  });

  if(!deleted) return res.status(404).json({error:'Canal de venda não encontrado'});
  res.json({ok:true});
} catch(e){ next(e);} });

export default router;