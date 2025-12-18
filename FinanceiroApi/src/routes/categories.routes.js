import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Category from '../models/Category.js';

const router = Router();
router.use(auth);

router.get('/', async (req,res,next)=>{
  try { const list = await Category.find({ userId: req.user.id }).sort({ nome:1 }); res.json(list); } catch(e){ next(e); }
});
router.post('/', async (req,res,next)=>{
  try { const { nome } = req.body; if(!nome) return res.status(400).json({error:'nome obrigatório'}); const cat = await Category.create({ userId:req.user.id, nome }); res.status(201).json(cat); } catch(e){ if(e.code===11000) return res.status(409).json({error:'Categoria duplicada'}); next(e); }
});
router.delete('/:id', async (req,res,next)=>{
  try { await Category.deleteOne({ _id:req.params.id, userId:req.user.id }); res.json({ok:true}); } catch(e){ next(e); }
});

export default router;
