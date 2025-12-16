import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import authRoutes from './src/routes/auth.routes.js';
import protectedRoutes from './src/routes/protected.routes.js';
import categoriesRoutes from './src/routes/categories.routes.js';
import paymentMethodsRoutes from './src/routes/paymentMethods.routes.js';
import receiptMethodsRoutes from './src/routes/receiptMethods.routes.js';
import expensesRoutes from './src/routes/expenses.routes.js';
import receiptsRoutes from './src/routes/receipts.routes.js';
import salesRoutes from './src/routes/sales.routes.js';
import syncRoutes from './src/routes/sync.routes.js';
import suppliersRoutes from './src/routes/suppliers.routes.js';
import salesChannelsRoutes from './src/routes/salesChannels.routes.js';
import accountsRoutes from './src/routes/accounts.routes.js';
import reportsRoutes from './src/routes/reports.routes.js';
import rabbitmqRoutes from './rabbitmq.routes.js';
app.use('/api/financeiro/rabbitmq', rabbitmqRoutes);
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import authRoutes from './src/routes/auth.routes.js';
import protectedRoutes from './src/routes/protected.routes.js';
import categoriesRoutes from './src/routes/categories.routes.js';
import paymentMethodsRoutes from './src/routes/paymentMethods.routes.js';
import receiptMethodsRoutes from './src/routes/receiptMethods.routes.js';
import expensesRoutes from './src/routes/expenses.routes.js';
import receiptsRoutes from './src/routes/receipts.routes.js';
import salesRoutes from './src/routes/sales.routes.js';
import syncRoutes from './src/routes/sync.routes.js';
import suppliersRoutes from './src/routes/suppliers.routes.js';
import salesChannelsRoutes from './src/routes/salesChannels.routes.js';
import accountsRoutes from './src/routes/accounts.routes.js';
import reportsRoutes from './src/routes/reports.routes.js';

const app = express();
app.use(cors({ origin: '*'}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (_req,res)=>{res.json({status:'ok', message:'API Sistema Financeiro'});});

app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/payment-methods', paymentMethodsRoutes);
app.use('/api/receipt-methods', receiptMethodsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/sales-channels', salesChannelsRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/reports', reportsRoutes);

// 404
app.use((req,res)=>{res.status(404).json({error:'Rota não encontrada'});});
// Error handler
app.use((err, _req, res, _next)=>{
  console.error('Erro:', err);
  res.status(err.status || 500).json({error: err.message || 'Erro interno'});
});

const PORT = process.env.PORT || 4000;
connectDB().then(()=>{
  app.listen(PORT, ()=> console.log(`🚀 Servidor rodando na porta ${PORT}`));
}).catch(err=>{
  console.error('Falha ao conectar MongoDB', err);
  process.exit(1);
});
