import { Component, OnInit, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './sales.html',
  styleUrl: './sales.css',
})
export class SalesComponent implements OnInit, AfterViewInit {
  sales: any[] = [];
  filteredSales: any[] = [];
  salesChannels: any[] = [];

  // Filtros
  filters = {
    descricao: '',
    valor: '',
    canal: '',
    periodo: ''
  };

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadSales();
    this.loadSalesChannels();
  }

  ngAfterViewInit() {
    this.setupEventListeners();
  }

  loadSales() {
    this.apiService.getSales().subscribe({
      next: (data) => {
        this.sales = data;
        this.filteredSales = [...this.sales];
        this.renderSalesTable();
      },
      error: (error) => {
        console.error('Erro ao carregar vendas:', error);
      }
    });
  }

  loadSalesChannels() {
    this.apiService.getSalesChannels().subscribe({
      next: (data) => {
        this.salesChannels = data;
        this.populateChannelSelect();
      },
      error: (error) => {
        console.error('Erro ao carregar canais de vendas:', error);
      }
    });
  }

  populateChannelSelect() {
    const select = document.getElementById('filtro-venda-canal') as HTMLSelectElement;
    if (select) {
      select.innerHTML = '<option value="">Todos</option>';
      this.salesChannels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel._id;
        option.textContent = channel.name;
        select.appendChild(option);
      });
    }
  }

  setupEventListeners() {
    // Botão filtrar
    const filterBtn = document.getElementById('btn-filtrar-vendas');
    if (filterBtn) {
      filterBtn.addEventListener('click', () => this.applyFilters());
    }

    // Botão limpar filtros
    const clearBtn = document.getElementById('btn-limpar-filtros-vendas');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearFilters());
    }

    // Filtros em tempo real
    const descricaoInput = document.getElementById('filtro-venda-descricao') as HTMLInputElement;
    const valorInput = document.getElementById('filtro-venda-valor') as HTMLInputElement;
    const canalSelect = document.getElementById('filtro-venda-canal') as HTMLSelectElement;
    const periodoInput = document.getElementById('filtro-venda-periodo') as HTMLInputElement;

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

    if (canalSelect) {
      canalSelect.addEventListener('change', () => {
        this.filters.canal = canalSelect.value;
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
    this.filteredSales = this.sales.filter(sale => {
      // Filtro por descrição
      if (this.filters.descricao && !sale.description.toLowerCase().includes(this.filters.descricao.toLowerCase())) {
        return false;
      }

      // Filtro por valor
      if (this.filters.valor) {
        const filterValue = parseFloat(this.filters.valor.replace(/[^\d,]/g, '').replace(',', '.'));
        if (isNaN(filterValue) || sale.value !== filterValue) {
          return false;
        }
      }

      // Filtro por canal
      if (this.filters.canal && sale.channel !== this.filters.canal) {
        return false;
      }

      // Filtro por período
      if (this.filters.periodo) {
        const [startDate, endDate] = this.filters.periodo.split(' à ').map(date => {
          const [day, month, year] = date.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        });

        const saleDate = new Date(sale.date);
        if (saleDate < startDate || saleDate > endDate) {
          return false;
        }
      }

      return true;
    });

    this.renderSalesTable();
  }

  clearFilters() {
    this.filters = {
      descricao: '',
      valor: '',
      canal: '',
      periodo: ''
    };

    // Limpar campos do DOM
    const descricaoInput = document.getElementById('filtro-venda-descricao') as HTMLInputElement;
    const valorInput = document.getElementById('filtro-venda-valor') as HTMLInputElement;
    const canalSelect = document.getElementById('filtro-venda-canal') as HTMLSelectElement;
    const periodoInput = document.getElementById('filtro-venda-periodo') as HTMLInputElement;

    if (descricaoInput) descricaoInput.value = '';
    if (valorInput) valorInput.value = '';
    if (canalSelect) canalSelect.value = '';
    if (periodoInput) periodoInput.value = '';

    this.filteredSales = [...this.sales];
    this.renderSalesTable();
  }

  renderSalesTable() {
    const tbody = document.getElementById('vendas-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.filteredSales.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="6" class="text-center">Nenhuma venda encontrada</td>';
      tbody.appendChild(row);
      return;
    }

    this.filteredSales.forEach(sale => {
      const row = document.createElement('tr');
      const channelName = this.salesChannels.find(c => c._id === sale.channel)?.name || 'N/A';

      row.innerHTML = `
        <td>${sale.description}</td>
        <td>${sale.notes || ''}</td>
        <td>R$ ${sale.value.toFixed(2).replace('.', ',')}</td>
        <td>${new Date(sale.date).toLocaleDateString('pt-BR')}</td>
        <td>${channelName}</td>
        <td>
          <button class="btn btn-sm btn-warning me-2" onclick="editSale('${sale._id}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteSale('${sale._id}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
}
