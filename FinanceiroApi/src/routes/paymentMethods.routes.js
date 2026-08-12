import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import PaymentMethod from '../models/PaymentMethod.js';

const router = Router();
router.use(auth);

router.get('/', async (req,res,next)=>{
  try { const list = await PaymentMethod.find({ userId:req.user.id }).sort({ nome:1 }); res.json(list); } catch(e){ next(e); }
});
router.post('/', async (req,res,next)=>{
  try { const { nome } = req.body; if(!nome) return res.status(400).json({error:'nome obrigatório'}); const pm = await PaymentMethod.create({ userId:req.user.id, nome }); res.status(201).json(pm); } catch(e){ if(e.code===11000) return res.status(409).json({error:'Forma duplicada'}); next(e); }
});
router.delete('/:id', async (req,res,next)=>{
  try { await PaymentMethod.deleteOne({ _id:req.params.id, userId:req.user.id }); res.json({ok:true}); } catch(e){ next(e); }
});

export default router;
