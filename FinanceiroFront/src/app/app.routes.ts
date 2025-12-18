import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Login } from './features/auth/login/login';
import { Dashboard } from './features/dashboard/dashboard';
import { AuthGuard } from './core/guards/auth.guard';
import { OverviewComponent } from './features/dashboard/pages/overview/overview';
import { ExpensesComponent } from './features/dashboard/pages/expenses/expenses';
import { ReceiptsComponent } from './features/dashboard/pages/receipts/receipts';
import { SalesComponent } from './features/dashboard/pages/sales/sales';
import { ReportsComponent } from './features/dashboard/pages/reports/reports';
import { BalanceComponent } from './features/dashboard/pages/balance/balance';
import { ExpenseFormComponent } from './features/dashboard/pages/expenses/expense-form/expense-form';
import { ExpenseCategoriesComponent } from './features/dashboard/pages/expenses/expense-categories/expense-categories';
import { ExpenseSuppliersComponent } from './features/dashboard/pages/expenses/expense-suppliers/expense-suppliers';
import { ReceiptFormComponent } from './features/dashboard/pages/receipts/receipt-form/receipt-form';
import { SaleFormComponent } from './features/dashboard/pages/sales/sale-form/sale-form';
import { SalesChannelsComponent } from './features/dashboard/pages/sales/sales-channels/sales-channels';
import { ExpensePaymentMethodsComponent } from './features/dashboard/pages/expenses/expense-payment-methods/expense-payment-methods';
import { ReceiptMethodsComponent } from './features/dashboard/pages/receipts/receipt-methods/receipt-methods';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login },
  { path: 'cadastro', component: Login },
  { 
    path: 'dashboard', 
    component: Dashboard,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: OverviewComponent },
      { path: 'expenses', component: ExpensesComponent },
      { path: 'expenses/categories', component: ExpenseCategoriesComponent },
      { path: 'expenses/suppliers', component: ExpenseSuppliersComponent },
      { path: 'expenses/payment-methods', component: ExpensePaymentMethodsComponent },
      { path: 'expenses/new', component: ExpenseFormComponent },
      { path: 'receipts', component: ReceiptsComponent },
      { path: 'receipts/methods', component: ReceiptMethodsComponent },
      { path: 'receipts/new', component: ReceiptFormComponent },
      { path: 'sales', component: SalesComponent },
      { path: 'sales/channels', component: SalesChannelsComponent },
      { path: 'sales/new', component: SaleFormComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'balance', component: BalanceComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
