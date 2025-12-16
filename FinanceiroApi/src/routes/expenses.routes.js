import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Expense from '../models/Expense.js';

const router = Router();
router.use(auth);

router.get('/', async (req,res,next)=>{
  try {
    const { from, to, search } = req.query;
    const q = { userId:req.user.id };
    if(from || to){
      q.dataVencimento = {};
      if(from) q.dataVencimento.$gte = from;
      if(to) q.dataVencimento.$lte = to;
    }
    if(search){ q.descricao = { $regex: search, $options:'i' }; }
    const list = await Expense.find(q).sort({ dataVencimento:1 });
    res.json(list);
  } catch(e){ next(e); }
});
router.post('/', async (req,res,next)=>{
  try { const body = req.body || {}; if(!body.descricao || !body.valor) return res.status(400).json({error:'descricao e valor obrigatórios'});
    const item = await Expense.create({ userId:req.user.id, ...body }); res.status(201).json(item); } catch(e){ next(e); }
});
router.put('/:id', async (req,res,next)=>{
  try { const upd = await Expense.findOneAndUpdate({ _id:req.params.id, userId:req.user.id }, req.body, { new:true }); if(!upd) return res.status(404).json({error:'Não encontrado'}); res.json(upd); } catch(e){ next(e); }
});
router.delete('/:id', async (req,res,next)=>{
  try { await Expense.deleteOne({ _id:req.params.id, userId:req.user.id }); res.json({ok:true}); } catch(e){ next(e); }
});
router.post('/:id/toggle-paid', async (req,res,next)=>{
  try { const exp = await Expense.findOne({ _id:req.params.id, userId:req.user.id }); if(!exp) return res.status(404).json({error:'Não encontrado'});
    exp.pago = !exp.pago; if(exp.pago){ exp.dataPagamento = exp.dataPagamento || new Date().toISOString().substring(0,10); } else { exp.dataPagamento=''; }
    await exp.save(); res.json(exp); } catch(e){ next(e); }
});

export default router;
