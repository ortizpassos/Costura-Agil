import { Router } from 'express';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/ping', auth, (req,res)=>{
  res.json({ message: 'pong', user: req.user });
});

export default router;
