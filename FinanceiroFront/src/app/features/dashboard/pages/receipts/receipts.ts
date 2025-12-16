import { Component, OnInit, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './receipts.html',
  styleUrl: './receipts.css',
})
export class ReceiptsComponent implements OnInit, AfterViewInit {
  receipts: any[] = [];
  filteredReceipts: any[] = [];
  receiptMethods: any[] = [];

  // Filtros
  filters = {
    descricao: '',
    valor: '',
    forma: '',
    periodo: ''
  };

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadReceipts();
    this.loadReceiptMethods();
  }

  ngAfterViewInit() {
    this.setupEventListeners();
  }

  loadReceipts() {
    this.apiService.getReceipts().subscribe({
      next: (data) => {
        this.receipts = data;
        this.filteredReceipts = [...this.receipts];
        this.renderReceiptsTable();
      },
      error: (error) => {
        console.error('Erro ao carregar recebimentos:', error);
      }
    });
  }

  loadReceiptMethods() {
    this.apiService.getReceiptMethods().subscribe({
      next: (data) => {
        this.receiptMethods = data;
        this.populateReceiptMethodSelect();
      },
      error: (error) => {
        console.error('Erro ao carregar formas de recebimento:', error);
      }
    });
  }

  populateReceiptMethodSelect() {
    const select = document.getElementById('filtro-receb-forma') as HTMLSelectElement;
    if (select) {
      select.innerHTML = '<option value="">Todas</option>';
      this.receiptMethods.forEach(method => {
        const option = document.createElement('option');
        option.value = method._id;
        option.textContent = method.name;
        select.appendChild(option);
      });
    }
  }

  setupEventListeners() {
    // Botão filtrar
    const filterBtn = document.getElementById('btn-filtrar-recebimentos');
    if (filterBtn) {
      filterBtn.addEventListener('click', () => this.applyFilters());
    }

    // Botão limpar filtros
    const clearBtn = document.getElementById('btn-limpar-filtros-recebimentos');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearFilters());
    }

    // Filtros em tempo real
    const descricaoInput = document.getElementById('filtro-receb-descricao') as HTMLInputElement;
    const valorInput = document.getElementById('filtro-receb-valor') as HTMLInputElement;
    const formaSelect = document.getElementById('filtro-receb-forma') as HTMLSelectElement;
    const periodoInput = document.getElementById('filtro-receb-periodo') as HTMLInputElement;

    if (descricaoInput) {
      descricaoInput.addEventListener('input', () => {
        this.filters.descricao = descricaoInput.value;
        this.applyFilters();
      });
    }

    if (valorInput) {
      valorInput.addEventListener('input', () => {
        this.filters.valor = valorInput.value;
        this.applyFilters();
      });
    }

    if (formaSelect) {
      formaSelect.addEventListener('change', () => {
        this.filters.forma = formaSelect.value;
        this.applyFilters();
      });
    }

    if (periodoInput) {
      periodoInput.addEventListener('input', () => {
        this.filters.periodo = periodoInput.value;
        this.applyFilters();
      });
    }
  }

  applyFilters() {
    this.filteredReceipts = this.receipts.filter(receipt => {
      // Filtro por descrição
      if (this.filters.descricao && !receipt.description.toLowerCase().includes(this.filters.descricao.toLowerCase())) {
        return false;
      }

      // Filtro por valor
      if (this.filters.valor) {
        const filterValue = parseFloat(this.filters.valor.replace(/[^\d,]/g, '').replace(',', '.'));
        if (isNaN(filterValue) || receipt.value !== filterValue) {
          return false;
        }
      }

      // Filtro por forma de recebimento
      if (this.filters.forma && receipt.receiptMethod !== this.filters.forma) {
        return false;
      }

      // Filtro por período
      if (this.filters.periodo) {
        const [startDate, endDate] = this.filters.periodo.split(' à ').map(date => {
          const [day, month, year] = date.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        });

        const receiptDate = new Date(receipt.date);
        if (receiptDate < startDate || receiptDate > endDate) {
          return false;
        }
      }

      return true;
    });

    this.renderReceiptsTable();
  }

  clearFilters() {
    this.filters = {
      descricao: '',
      valor: '',
      forma: '',
      periodo: ''
    };

    // Limpar campos do DOM
    const descricaoInput = document.getElementById('filtro-receb-descricao') as HTMLInputElement;
    const valorInput = document.getElementById('filtro-receb-valor') as HTMLInputElement;
    const formaSelect = document.getElementById('filtro-receb-forma') as HTMLSelectElement;
    const periodoInput = document.getElementById('filtro-receb-periodo') as HTMLInputElement;

    if (descricaoInput) descricaoInput.value = '';
    if (valorInput) valorInput.value = '';
    if (formaSelect) formaSelect.value = '';
    if (periodoInput) periodoInput.value = '';

    this.filteredReceipts = [...this.receipts];
    this.renderReceiptsTable();
  }

  renderReceiptsTable() {
    const tbody = document.getElementById('recebimentos-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.filteredReceipts.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="6" class="text-center">Nenhum recebimento encontrado</td>';
      tbody.appendChild(row);
      return;
    }

    this.filteredReceipts.forEach(receipt => {
      const row = document.createElement('tr');
      const receiptMethodName = this.receiptMethods.find(r => r._id === receipt.receiptMethod)?.name || 'N/A';

      row.innerHTML = `
        <td>${receipt.description}</td>
        <td>${receipt.notes || ''}</td>
        <td>R$ ${receipt.value.toFixed(2).replace('.', ',')}</td>
        <td>${new Date(receipt.date).toLocaleDateString('pt-BR')}</td>
        <td>${receiptMethodName}</td>
        <td>
          <button class="btn btn-sm btn-warning me-2" onclick="editReceipt('${receipt._id}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteReceipt('${receipt._id}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
}
