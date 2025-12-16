import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ActivatedRoute } from '@angular/router';

interface DREData {
  period: { start: string; end: string };
  revenue: number;
  expenses: number;
  profit: number;
  sales: number;
  expenseCount: number;
}

interface CashFlowData {
  period: { start: string; end: string };
  initialBalance: number;
  receipts: number;
  payments: number;
  netCashFlow: number;
  currentBalance: number;
  finalBalance: number;
  receiptCount: number;
  paymentCount: number;
}

interface AccountsPayableData {
  period: { month: number; year: number; monthName: string };
  expenses: any[];
  totalValue: number;
  count: number;
}

interface SalesReportData {
  period: { start: string; end: string };
  sales: any[];
  summary: {
    totalValue: number;
    totalSales: number;
    totalItems: number;
    averageValue: number;
  };
  salesByChannel: { [key: string]: { count: number; value: number } };
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class ReportsComponent implements OnInit {
  readonly isLoading = signal(false);
  readonly feedback = signal('');
  readonly showDREModal = signal(false);
  readonly showCashFlowModal = signal(false);
  readonly showAccountsPayableModal = signal(false);
  readonly showSalesReportModal = signal(false);

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  // Dados dos relatórios
  dreData = signal<DREData | null>(null);
  cashFlowData = signal<CashFlowData | null>(null);
  accountsPayableData = signal<AccountsPayableData | null>(null);
  salesReportData = signal<SalesReportData | null>(null);

  // Formulários de filtro
  dreForm = this.fb.group({
    startDate: [this.getDefaultStartDate()],
    endDate: [this.getDefaultEndDate()]
  });

  cashFlowForm = this.fb.group({
    startDate: [this.getDefaultStartDate()],
    endDate: [this.getDefaultEndDate()]
  });

  accountsPayableForm = this.fb.group({
    month: [new Date().getMonth() + 1],
    year: [new Date().getFullYear()]
  });

  salesReportForm = this.fb.group({
    startDate: [this.getDefaultStartDate()],
    endDate: [this.getDefaultEndDate()]
  });

  ngOnInit(): void {
    // Verificar se há query params para abrir modal específico
    this.route.queryParams.subscribe(params => {
      const reportType = params['type'];
      if (reportType) {
        // Pequeno delay para garantir que o componente esteja totalmente carregado
        setTimeout(() => {
          this.openReportFromQueryParam(reportType);
        }, 100);
      }
    });
  }

  private openReportFromQueryParam(type: string): void {
    switch (type) {
      case 'accounts-payable':
        this.generateAccountsPayable();
        break;
      case 'accounts-paid':
        // Para contas pagas, podemos usar o mesmo método mas filtrar por status pago
        // Por enquanto, vamos abrir o modal de contas a pagar
        this.generateAccountsPayable();
        break;
      case 'dre':
        this.generateDRE();
        break;
      case 'cash-flow':
        this.generateCashFlow();
        break;
      case 'sales':
        this.generateSalesReport();
        break;
    }
  }

  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(1); // Primeiro dia do mês
    return date.toISOString().split('T')[0];
  }

  private getDefaultEndDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1, 0); // Último dia do mês
    return date.toISOString().split('T')[0];
  }

  // DRE - Demonstrativo de Resultado do Exercício
  generateDRE(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    const { startDate, endDate } = this.dreForm.value;

    this.api.get<DREData>(`reports/dre?startDate=${startDate}&endDate=${endDate}`)
      .subscribe({
        next: (data) => {
          this.dreData.set(data);
          this.showDREModal.set(true);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.feedback.set(error.error?.message || 'Erro ao gerar DRE.');
          this.isLoading.set(false);
        }
      });
  }

  // Fluxo de Caixa
  generateCashFlow(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    const { startDate, endDate } = this.cashFlowForm.value;

    this.api.get<CashFlowData>(`reports/cash-flow?startDate=${startDate}&endDate=${endDate}`)
      .subscribe({
        next: (data) => {
          this.cashFlowData.set(data);
          this.showCashFlowModal.set(true);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.feedback.set(error.error?.message || 'Erro ao gerar fluxo de caixa.');
          this.isLoading.set(false);
        }
      });
  }

  // Contas a Pagar
  generateAccountsPayable(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    const { month, year } = this.accountsPayableForm.value;

    this.api.get<AccountsPayableData>(`reports/accounts-payable?month=${month}&year=${year}`)
      .subscribe({
        next: (data) => {
          this.accountsPayableData.set(data);
          this.showAccountsPayableModal.set(true);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.feedback.set(error.error?.message || 'Erro ao gerar relatório de contas a pagar.');
          this.isLoading.set(false);
        }
      });
  }

  // Relatório de Vendas
  generateSalesReport(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    const { startDate, endDate } = this.salesReportForm.value;

    this.api.get<SalesReportData>(`reports/sales-period?startDate=${startDate}&endDate=${endDate}`)
      .subscribe({
        next: (data) => {
          this.salesReportData.set(data);
          this.showSalesReportModal.set(true);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.feedback.set(error.error?.message || 'Erro ao gerar relatório de vendas.');
          this.isLoading.set(false);
        }
      });
  }

  // Métodos de formatação
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR');
  }

  // Métodos de fechamento dos modais
  closeDREModal(): void {
    this.showDREModal.set(false);
    this.dreData.set(null);
  }

  closeCashFlowModal(): void {
    this.showCashFlowModal.set(false);
    this.cashFlowData.set(null);
  }

  closeAccountsPayableModal(): void {
    this.showAccountsPayableModal.set(false);
    this.accountsPayableData.set(null);
  }

  closeSalesReportModal(): void {
    this.showSalesReportModal.set(false);
    this.salesReportData.set(null);
  }

  // Método para imprimir relatórios
  printReport(reportType: string): void {
    window.print();
  }

  // Método para obter valor absoluto
  getAbsoluteValue(value: number): number {
    return Math.abs(value);
  }

  // Método auxiliar para iterar sobre chaves de objeto
  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  // Método para exportar para PDF (futuro)
  exportToPDF(reportType: string): void {
    // Implementação futura
    alert('Funcionalidade de exportação para PDF será implementada em breve.');
  }
}
