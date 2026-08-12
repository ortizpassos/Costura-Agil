import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Sale from '../models/Sale.js';

const router = Router();
router.use(auth);

router.get('/', async (req,res,next)=>{ try { const { from, to, search } = req.query; const q={ userId:req.user.id }; if(from||to){ q.dataVenda={}; if(from) q.dataVenda.$gte=from; if(to) q.dataVenda.$lte=to; } if(search){ q.descricao={ $regex:search, $options:'i' }; } const list = await Sale.find(q).populate('canal', 'nome').sort({ dataVenda:1 }); res.json(list); } catch(e){ next(e); } });
router.post('/', async (req,res,next)=>{ try { const b=req.body||{}; if(!b.descricao||!b.valor) return res.status(400).json({error:'descricao e valor obrigatórios'}); const item=await Sale.create({ userId:req.user.id, ...b }); res.status(201).json(item);} catch(e){ next(e);} });
router.put('/:id', async (req,res,next)=>{ try { const upd = await Sale.findOneAndUpdate({ _id:req.params.id, userId:req.user.id }, req.body, { new:true }); if(!upd) return res.status(404).json({error:'Não encontrado'}); res.json(upd);} catch(e){ next(e);} });
router.delete('/:id', async (req,res,next)=>{ try { await Sale.deleteOne({ _id:req.params.id, userId:req.user.id }); res.json({ok:true}); } catch(e){ next(e);} });

export default router;
