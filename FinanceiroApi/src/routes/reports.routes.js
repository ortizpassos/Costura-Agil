import express from 'express';
import { auth } from '../middleware/auth.js';
import Account from '../models/Account.js';
import Expense from '../models/Expense.js';
import Sale from '../models/Sale.js';
import Receipt from '../models/Receipt.js';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(auth);

// DRE - Demonstrativo de Resultado do Exercício
router.get('/dre', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Definir período padrão (mês atual)
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    // Receitas (Vendas)
    const sales = await Sale.find({
      createdAt: { $gte: start, $lte: end },
      ativo: true
    });

    const totalRevenue = sales.reduce((sum, sale) => sum + sale.valorTotal, 0);

    // Despesas
    const expenses = await Expense.find({
      createdAt: { $gte: start, $lte: end },
      ativo: true
    });

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.valor, 0);

    // Lucro/Prejuízo
    const profit = totalRevenue - totalExpenses;

    res.json({
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: profit,
      sales: sales.length,
      expenseCount: expenses.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar DRE', error: error.message });
  }
});

// Fluxo de Caixa
router.get('/cash-flow', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Definir período padrão (mês atual)
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    // Recebimentos (Vendas pagas)
    const receipts = await Receipt.find({
      createdAt: { $gte: start, $lte: end },
      ativo: true
    });

    const totalReceipts = receipts.reduce((sum, receipt) => sum + receipt.valor, 0);

    // Pagamentos (Despesas pagas)
    const expenses = await Expense.find({
      createdAt: { $gte: start, $lte: end },
      ativo: true,
      status: 'pago'
    });

    const totalPayments = expenses.reduce((sum, expense) => sum + expense.valor, 0);

    // Saldo das contas no início do período
    const accounts = await Account.find({ ativo: true });
    const initialBalance = accounts.reduce((sum, account) => sum + account.saldoInicial, 0);

    // Saldo atual das contas
    const currentBalance = accounts.reduce((sum, account) => sum + account.saldoAtual, 0);

    // Fluxo de caixa
    const netCashFlow = totalReceipts - totalPayments;
    const finalBalance = initialBalance + netCashFlow;

    res.json({
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      initialBalance,
      receipts: totalReceipts,
      payments: totalPayments,
      netCashFlow,
      currentBalance,
      finalBalance,
      receiptCount: receipts.length,
      paymentCount: expenses.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar fluxo de caixa', error: error.message });
  }
});

// Relatório de Contas a Pagar
router.get('/accounts-payable', async (req, res) => {
  try {
    const { month, year } = req.query;

    const targetMonth = month ? parseInt(month) : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);

    const expenses = await Expense.find({
      createdAt: { $gte: startDate, $lte: endDate },
      ativo: true
    }).populate('categoria', 'nome').populate('formaPagamento', 'nome');

    const totalValue = expenses.reduce((sum, expense) => sum + expense.valor, 0);

    res.json({
      period: {
        month: targetMonth + 1,
        year: targetYear,
        monthName: new Date(targetYear, targetMonth).toLocaleString('pt-BR', { month: 'long' })
      },
      expenses,
      totalValue,
      count: expenses.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar relatório de contas a pagar', error: error.message });
  }
});

// Relatório de Contas Pagas
router.get('/accounts-paid', async (req, res) => {
  try {
    const { month, year } = req.query;

    const targetMonth = month ? parseInt(month) : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);

    const expenses = await Expense.find({
      createdAt: { $gte: startDate, $lte: endDate },
      ativo: true,
      status: 'pago'
    }).populate('categoria', 'nome').populate('formaPagamento', 'nome');

    const totalValue = expenses.reduce((sum, expense) => sum + expense.valor, 0);

    res.json({
      period: {
        month: targetMonth + 1,
        year: targetYear,
        monthName: new Date(targetYear, targetMonth).toLocaleString('pt-BR', { month: 'long' })
      },
      expenses,
      totalValue,
      count: expenses.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar relatório de contas pagas', error: error.message });
  }
});

// Relatório de Vendas por Período
router.get('/sales-period', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    const sales = await Sale.find({
      createdAt: { $gte: start, $lte: end },
      ativo: true
    }).populate('canal', 'nome');

    const totalValue = sales.reduce((sum, sale) => sum + sale.valorTotal, 0);
    const totalItems = sales.reduce((sum, sale) => sum + sale.itens.length, 0);

    // Agrupar por canal
    const salesByChannel = sales.reduce((acc, sale) => {
      const channelName = sale.canal?.nome || 'Não informado';
      if (!acc[channelName]) {
        acc[channelName] = { count: 0, value: 0 };
      }
      acc[channelName].count++;
      acc[channelName].value += sale.valorTotal;
      return acc;
    }, {});

    res.json({
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      sales,
      summary: {
        totalValue,
        totalSales: sales.length,
        totalItems,
        averageValue: sales.length > 0 ? totalValue / sales.length : 0
      },
      salesByChannel
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar relatório de vendas', error: error.message });
  }
});

export default router;