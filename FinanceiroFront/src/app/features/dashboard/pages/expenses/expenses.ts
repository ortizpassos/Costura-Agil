import { Component, OnInit, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './expenses.html',
  styleUrl: './expenses.css',
})
export class ExpensesComponent implements OnInit, AfterViewInit {
  expenses: any[] = [];
  filteredExpenses: any[] = [];
  categories: any[] = [];
  suppliers: any[] = [];
  paymentMethods: any[] = [];

  // Filtros
  filters = {
    descricao: '',
    status: '',
    periodo: '',
    categoria: '',
    fornecedor: '',
    formaPagamento: ''
  };

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadExpenses();
    this.loadCategories();
    this.loadSuppliers();
    this.loadPaymentMethods();
  }

  ngAfterViewInit() {
    this.setupEventListeners();
  }

  loadExpenses() {
    this.apiService.getExpenses().subscribe({
      next: (data) => {
        this.expenses = data;
        this.filteredExpenses = [...this.expenses];
        this.renderExpensesTable();
      },
      error: (error) => {
        console.error('Erro ao carregar despesas:', error);
      }
    });
  }

  loadCategories() {
    this.apiService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.populateCategorySelect();
      },
      error: (error) => {
        console.error('Erro ao carregar categorias:', error);
      }
    });
  }

  loadSuppliers() {
    this.apiService.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers = data;
        this.populateSupplierSelect();
      },
      error: (error) => {
        console.error('Erro ao carregar fornecedores:', error);
      }
    });
  }

  loadPaymentMethods() {
    this.apiService.getPaymentMethods().subscribe({
      next: (data) => {
        this.paymentMethods = data;
        this.populatePaymentMethodSelect();
      },
      error: (error) => {
        console.error('Erro ao carregar formas de pagamento:', error);
      }
    });
  }

  populateCategorySelect() {
    const select = document.getElementById('filtro-categoria') as HTMLSelectElement;
    if (select) {
      select.innerHTML = '<option value="">Todas</option>';
      this.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category._id;
        option.textContent = category.name;
        select.appendChild(option);
      });
    }
  }

  populateSupplierSelect() {
    const select = document.getElementById('filtro-fornecedor') as HTMLSelectElement;
    if (select) {
      select.innerHTML = '<option value="">Todos</option>';
      this.suppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier._id;
        option.textContent = supplier.name;
        select.appendChild(option);
      });
    }
  }

  populatePaymentMethodSelect() {
    const select = document.getElementById('filtro-forma-pagamento') as HTMLSelectElement;
    if (select) {
      select.innerHTML = '<option value="">Todas</option>';
      this.paymentMethods.forEach(method => {
        const option = document.createElement('option');
        option.value = method._id;
        option.textContent = method.name;
        select.appendChild(option);
      });
    }
  }

  setupEventListeners() {
    // Botão filtrar
    const filterBtn = document.getElementById('btn-filtrar-despesas');
    if (filterBtn) {
      filterBtn.addEventListener('click', () => this.applyFilters());
    }

    // Botão limpar filtros
    const clearBtn = document.getElementById('btn-limpar-filtros-despesas');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearFilters());
    }

    // Filtros em tempo real
    const descricaoInput = document.getElementById('filtro-descricao') as HTMLInputElement;
    const statusSelect = document.getElementById('filtro-status') as HTMLSelectElement;
    const periodoInput = document.getElementById('filtro-periodo') as HTMLInputElement;
    const categoriaSelect = document.getElementById('filtro-categoria') as HTMLSelectElement;
    const fornecedorSelect = document.getElementById('filtro-fornecedor') as HTMLSelectElement;
    const formaPagamentoSelect = document.getElementById('filtro-forma-pagamento') as HTMLSelectElement;

    if (descricaoInput) {
      descricaoInput.addEventListener('input', () => {
        this.filters.descricao = descricaoInput.value;
        this.applyFilters();
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', () => {
        this.filters.status = statusSelect.value;
        this.applyFilters();
      });
    }

    if (periodoInput) {
      periodoInput.addEventListener('input', () => {
        this.filters.periodo = periodoInput.value;
        this.applyFilters();
      });
    }

    if (categoriaSelect) {
      categoriaSelect.addEventListener('change', () => {
        this.filters.categoria = categoriaSelect.value;
        this.applyFilters();
      });
    }

    if (fornecedorSelect) {
      fornecedorSelect.addEventListener('change', () => {
        this.filters.fornecedor = fornecedorSelect.value;
        this.applyFilters();
      });
    }

    if (formaPagamentoSelect) {
      formaPagamentoSelect.addEventListener('change', () => {
        this.filters.formaPagamento = formaPagamentoSelect.value;
        this.applyFilters();
      });
    }
  }

  applyFilters() {
    this.filteredExpenses = this.expenses.filter(expense => {
      // Filtro por descrição
      if (this.filters.descricao && !expense.description.toLowerCase().includes(this.filters.descricao.toLowerCase())) {
        return false;
      }

      // Filtro por status
      if (this.filters.status) {
        const status = this.filters.status === 'pago' ? 'paid' : 'pending';
        if (expense.status !== status) {
          return false;
        }
      }

      // Filtro por período (usando data de vencimento)
      if (this.filters.periodo) {
        const [startDate, endDate] = this.filters.periodo.split(' à ').map(date => {
          const [day, month, year] = date.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        });

        const expenseDate = new Date(expense.dueDate);
        if (expenseDate < startDate || expenseDate > endDate) {
          return false;
        }
      }

      // Filtro por categoria
      if (this.filters.categoria && expense.category !== this.filters.categoria) {
        return false;
      }

      // Filtro por fornecedor
      if (this.filters.fornecedor && expense.supplier !== this.filters.fornecedor) {
        return false;
      }

      // Filtro por forma de pagamento
      if (this.filters.formaPagamento && expense.paymentMethod !== this.filters.formaPagamento) {
        return false;
      }

      return true;
    });

    this.renderExpensesTable();
  }

  clearFilters() {
    this.filters = {
      descricao: '',
      status: '',
      periodo: '',
      categoria: '',
      fornecedor: '',
      formaPagamento: ''
    };

    // Limpar campos do DOM
    const descricaoInput = document.getElementById('filtro-descricao') as HTMLInputElement;
    const statusSelect = document.getElementById('filtro-status') as HTMLSelectElement;
    const periodoInput = document.getElementById('filtro-periodo') as HTMLInputElement;
    const categoriaSelect = document.getElementById('filtro-categoria') as HTMLSelectElement;
    const fornecedorSelect = document.getElementById('filtro-fornecedor') as HTMLSelectElement;
    const formaPagamentoSelect = document.getElementById('filtro-forma-pagamento') as HTMLSelectElement;

    if (descricaoInput) descricaoInput.value = '';
    if (statusSelect) statusSelect.value = '';
    if (periodoInput) periodoInput.value = '';
    if (categoriaSelect) categoriaSelect.value = '';
    if (fornecedorSelect) fornecedorSelect.value = '';
    if (formaPagamentoSelect) formaPagamentoSelect.value = '';

    this.filteredExpenses = [...this.expenses];
    this.renderExpensesTable();
  }

  renderExpensesTable() {
    const tbody = document.getElementById('despesas-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.filteredExpenses.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="7" class="text-center">Nenhuma despesa encontrada</td>';
      tbody.appendChild(row);
      return;
    }

    this.filteredExpenses.forEach(expense => {
      const row = document.createElement('tr');
      const categoryName = this.categories.find(c => c._id === expense.category)?.name || 'N/A';
      const supplierName = this.suppliers.find(s => s._id === expense.supplier)?.name || 'N/A';
      const paymentMethodName = this.paymentMethods.find(p => p._id === expense.paymentMethod)?.name || 'N/A';
      const statusText = expense.status === 'paid' ? 'Pago' : 'A Pagar';
      const statusClass = expense.status === 'paid' ? 'text-success' : 'text-warning';

      row.innerHTML = `
        <td>${expense.description}</td>
        <td>${expense.notes || ''}</td>
        <td>R$ ${expense.value.toFixed(2).replace('.', ',')}</td>
        <td>${new Date(expense.purchaseDate).toLocaleDateString('pt-BR')}</td>
        <td>${new Date(expense.dueDate).toLocaleDateString('pt-BR')}</td>
        <td>${expense.paymentDate ? new Date(expense.paymentDate).toLocaleDateString('pt-BR') : '-'}</td>
        <td>
          <span class="${statusClass}">${statusText}</span><br>
          <small class="text-muted">${categoryName} | ${supplierName} | ${paymentMethodName}</small>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
}
