import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './expense-form.html',
  styleUrl: './expense-form.css',
})
export class ExpenseFormComponent implements OnInit {
  categories: Array<{ _id: string; nome: string }> = [];
  suppliers: Array<{ _id: string; nome: string }> = [];
  paymentMethods: Array<{ _id: string; nome: string }> = [];

  showCategoryModal = false;
  showSupplierModal = false;

  categoryModalLoading = false;
  supplierModalLoading = false;

  categoryModalFeedback = '';
  supplierModalFeedback = '';

  categoryModalNome = '';

  supplierModal = {
    nome: '',
    contato: '',
    telefone: '',
    email: '',
  };

  constructor(
    private api: ApiService, 
    private router: Router, 
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadSuppliers();
    this.loadPaymentMethods();
  }

  private loadCategories(): void {
    this.api.get<Array<{ _id: string; nome: string }>>('/categories').subscribe({
      next: (list) => {
        this.categories = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
      }
    });
  }

  private loadSuppliers(): void {
    this.api.get<Array<{ _id: string; nome: string }>>('/suppliers').subscribe({
      next: (list) => {
        this.suppliers = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
      }
    });
  }

  private loadPaymentMethods(): void {
    this.api.get<Array<{ _id: string; nome: string }>>('/payment-methods').subscribe({
      next: (list) => {
        this.paymentMethods = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
      }
    });
  }

  openCategoryModal(): void {
    this.categoryModalNome = '';
    this.categoryModalFeedback = '';
    this.categoryModalLoading = false;
    this.showCategoryModal = true;
    setTimeout(() => {
      const input = document.getElementById('modal-categoria-nome') as HTMLInputElement | null;
      input?.focus();
    }, 0);
  }

  closeCategoryModal(): void {
    this.resetCategoryModal()
  }

  saveCategoryFromModal(): void {
    const nome = this.categoryModalNome.trim();

    if (nome.length < 2) {
      this.categoryModalFeedback = 'Informe pelo menos 2 caracteres.';
      return;
    }

    this.categoryModalLoading = true;
    this.categoryModalFeedback = '';
    this.cdr.detectChanges();

    this.api.post<{ _id: string; nome: string }>('/categories', { nome }).subscribe({
      next: (created) => {
        this.categories = [...this.categories, created].sort((a, b) => a.nome.localeCompare(b.nome));
        this.categoryModalLoading = false;
        this.showCategoryModal = false;
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.selectOption('despesa-categoria', created.nome);
        }, 50);
      },
      error: (err: any) => {
        const message = err?.error?.message || err?.message || 'Erro ao salvar categoria.';
        this.categoryModalFeedback = message === 'Categoria duplicada'
          ? 'Esta categoria já existe.'
          : message;
        this.categoryModalLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openSupplierModal(): void {
    this.supplierModal = { nome: '', contato: '', telefone: '', email: '' };
    this.supplierModalFeedback = '';
    this.supplierModalLoading = false;
    this.showSupplierModal = true;
    setTimeout(() => {
      const input = document.getElementById('modal-fornecedor-nome') as HTMLInputElement | null;
      input?.focus();
    }, 0);
  }

  closeSupplierModal(): void {
    this.resetSupplierModal();
  }

  saveSupplierFromModal(): void {
    const payload = {
      nome: this.supplierModal.nome.trim(),
      contato: this.supplierModal.contato.trim(),
      telefone: this.supplierModal.telefone.trim(),
      email: this.supplierModal.email.trim(),
    };

    if (!payload.nome || payload.nome.length < 2) {
      this.supplierModalFeedback = 'Informe o nome do fornecedor com pelo menos 2 caracteres.';
      return;
    }

    this.supplierModalLoading = true;
    this.supplierModalFeedback = '';
    this.cdr.detectChanges();

    this.api.post<{ _id: string; nome: string }>('/suppliers', payload).subscribe({
      next: (created) => {
        this.suppliers = [...this.suppliers, created].sort((a, b) => a.nome.localeCompare(b.nome));
        this.supplierModalLoading = false;
        this.showSupplierModal = false;
        this.cdr.detectChanges();

        setTimeout(() => {
          this.selectOption('despesa-fornecedor', created.nome);
        }, 50);
      },
      error: (err: any) => {
        const message = err?.error?.message || err?.message || 'Erro ao salvar fornecedor.';
        this.supplierModalFeedback = message === 'Fornecedor duplicado'
          ? 'Este fornecedor já existe.'
          : message;
        this.supplierModalLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private selectOption(elementId: string, value: string): void {
    const select = document.getElementById(elementId) as HTMLSelectElement | null;
    if (!select) {
      return;
    }

    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  private resetCategoryModal(): void {
    this.categoryModalLoading = false;
    this.showCategoryModal = false;
    this.categoryModalNome = '';
    this.categoryModalFeedback = '';
  }

  private resetSupplierModal(): void {
    this.supplierModalLoading = false;
    this.showSupplierModal = false;
    this.supplierModalFeedback = '';
    this.supplierModal = { nome: '', contato: '', telefone: '', email: '' };
  }

  salvarDespesa() {
    // Coleta os dados dos campos do formulário
    const descricao = (document.getElementById('despesa-descricao') as HTMLInputElement)?.value;
    const dataCompra = (document.getElementById('despesa-data-compra') as HTMLInputElement)?.value;
    const dataVencimento = (document.getElementById('despesa-data-vencimento') as HTMLInputElement)?.value;
    const valor = (document.getElementById('despesa-valor') as HTMLInputElement)?.value.replace(/[^0-9,.-]+/g, '').replace(',', '.');
    const parcelado = (document.getElementById('despesa-parcelado') as HTMLSelectElement)?.value;
    const fixa = (document.getElementById('despesa-fixa') as HTMLSelectElement)?.value;
    const categoria = (document.getElementById('despesa-categoria') as HTMLSelectElement)?.value;
    const fornecedor = (document.getElementById('despesa-fornecedor') as HTMLSelectElement)?.value;
    const observacoes = (document.getElementById('despesa-observacoes') as HTMLTextAreaElement)?.value;
    const dataPagamento = (document.getElementById('despesa-data-pagamento') as HTMLInputElement)?.value;
    const valorPago = (document.getElementById('despesa-valor-pago') as HTMLInputElement)?.value.replace(/[^0-9,.-]+/g, '').replace(',', '.');
    const formaPagamento = (document.getElementById('despesa-forma-pagamento') as HTMLSelectElement)?.value;
    const pago = (document.getElementById('despesa-pagamento-realizado') as HTMLInputElement)?.checked;

    const body: any = {
      descricao,
      dataCompra,
      dataVencimento,
      valor: parseFloat(valor) || 0,
      parcelado,
      fixa,
      categoria,
      fornecedor,
      observacoes,
      dataPagamento,
      valorPago: parseFloat(valorPago) || 0,
      formaPagamento,
      pago
    };

    this.api.post('/expenses', body).subscribe({
      next: () => this.router.navigate(['/dashboard/expenses']),
      error: (err: any) => alert('Erro ao salvar despesa: ' + (err?.message || ''))
    });
  }
}
