import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = Router();

function signToken(user){
  return jwt.sign({ id: user._id, email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
}

router.post('/register', async (req,res,next)=>{
  try{
    const { name, email, password } = req.body;
    if(!name || !email || !password) return res.status(400).json({error:'Dados incompletos'});
    const exists = await User.findOne({ email });
    if(exists) return res.status(409).json({error:'Email já registrado'});
    const user = await User.create({ name, email, password });
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch(err){ next(err); }
});

router.post('/login', async (req,res,next)=>{
  try{
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({error:'Informe email e senha'});
    const user = await User.findOne({ email });
    if(!user) return res.status(401).json({error:'Credenciais inválidas'});
    const ok = await user.comparePassword(password);
    if(!ok) return res.status(401).json({error:'Credenciais inválidas'});
    const token = signToken(user);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch(err){ next(err); }
});

router.get('/me', auth, async (req,res,next)=>{
  try{
    const user = await User.findById(req.user.id).select('-password');
    if(!user) return res.status(404).json({error:'Usuário não encontrado'});
    res.json({ user });
  } catch(err){ next(err); }
});

export default router;
