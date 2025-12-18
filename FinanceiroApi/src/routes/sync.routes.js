import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Category from '../models/Category.js';
import PaymentMethod from '../models/PaymentMethod.js';
import ReceiptMethod from '../models/ReceiptMethod.js';
import Expense from '../models/Expense.js';
import Receipt from '../models/Receipt.js';
import Sale from '../models/Sale.js';

const router = Router();
router.use(auth);

// Recebe itens offline (com ids locais) e cria no servidor, retornando mapeamento { localId,newId }
router.post('/', async (req,res,next)=>{
  const userId = req.user.id;
  const body = req.body || {};
  const result = { categories:[], paymentMethods:[], receiptMethods:[], expenses:[], receipts:[], sales:[] };
  try {
    // Helper para evitar duplicados simples por nome
    const ensureByName = async (Model, nome, queryExtra={}) => {
      if(!nome) return null;
      const found = await Model.findOne({ userId, nome, ...queryExtra });
      return found || await Model.create({ userId, nome, ...queryExtra });
    };
    if(Array.isArray(body.categories)){
      for(const item of body.categories){
        if(!item || !item.nome) continue;
        const created = await ensureByName(Category, item.nome);
        result.categories.push({ localId:item.id, newId:created._id.toString() });
      }
    }
    if(Array.isArray(body.paymentMethods)){
      for(const item of body.paymentMethods){
        if(!item || !item.nome) continue;
        const created = await ensureByName(PaymentMethod, item.nome);
        result.paymentMethods.push({ localId:item.id, newId:created._id.toString() });
      }
    }
    if(Array.isArray(body.receiptMethods)){
      for(const item of body.receiptMethods){
        if(!item || !item.nome) continue;
        const created = await ensureByName(ReceiptMethod, item.nome);
        result.receiptMethods.push({ localId:item.id, newId:created._id.toString() });
      }
    }
    if(Array.isArray(body.expenses)){
      for(const e of body.expenses){
        if(!e || !e.descricao || e.valor==null) continue;
        const created = await Expense.create({ userId, descricao:e.descricao, observacoes:e.observacoes||'', valor:e.valor||0, dataCompra:e.dataCompra, dataVencimento:e.dataVencimento, dataPagamento:e.dataPagamento||'', categoria:e.categoria||'', fornecedor:e.fornecedor||'', formaPagamento:e.formaPagamento||'', valorPago:e.valorPago||0, pago:!!e.pago });
        result.expenses.push({ localId:e.id, newId:created._id.toString() });
      }
    }
    if(Array.isArray(body.receipts)){
      for(const r of body.receipts){
        if(!r || !r.descricao || r.valor==null) continue;
        const created = await Receipt.create({ userId, descricao:r.descricao, observacoes:r.observacoes||'', valor:r.valor||0, dataRecebimento:r.dataRecebimento, formaRecebimento:r.formaRecebimento||'' });
        result.receipts.push({ localId:r.id, newId:created._id.toString() });
      }
    }
    if(Array.isArray(body.sales)){
      for(const s of body.sales){
        if(!s || !s.descricao || s.valor==null) continue;
        const created = await Sale.create({ userId, descricao:s.descricao, observacoes:s.observacoes||'', valor:s.valor||0, dataVenda:s.dataVenda, canal:s.canal||'' });
        result.sales.push({ localId:s.id, newId:created._id.toString() });
      }
    }
    res.json(result);
  } catch(err){ next(err); }
});

export default router;