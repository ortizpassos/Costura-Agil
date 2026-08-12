import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';

@Component({
  selector: 'app-receipt-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './receipt-form.html',
  styleUrl: './receipt-form.css',
})
export class ReceiptFormComponent implements OnInit {
  
  receiptMethods: Array<{ _id: string; nome: string }> = [];

  descricao = '';
  dataRecebimento = '';
  valor = '';
  formaRecebimento = '';
  observacoes = '';

  showReceiptMethodModal = false;
  receiptMethodModalLoading = false;
  receiptMethodModalFeedback = '';
  receiptMethodModalNome = '';

  constructor(
    private api: ApiService, 
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadReceiptMethods();
    this.initializeFields();
  }

  private initializeFields(): void {
    this.dataRecebimento = new Date().toISOString().split('T')[0];
  }

  private loadReceiptMethods(): void {
    this.api.get<Array<{ _id: string; nome: string }>>('/receipt-methods').subscribe({
      next: (list) => {
        this.receiptMethods = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
        this.cdr.detectChanges();
      }
    });
  }

  salvarRecebimento(): void {
    const valorNumerico = parseFloat(this.valor.replace('R$', '').replace('.', '').replace(',', '.').trim());

    if (!this.descricao.trim()) {
      alert('A descrição é obrigatória.');
      return;
    }
    if (!this.dataRecebimento) {
      alert('A data de recebimento é obrigatória.');
      return;
    }
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      alert('O valor do recebimento é obrigatório e deve ser maior que zero.');
      return;
    }
    if (!this.formaRecebimento) {
      alert('A forma de recebimento é obrigatória.');
      return;
    }

    const payload = {
      descricao: this.descricao,
      valor: valorNumerico,
      dataRecebimento: this.dataRecebimento,
      formaRecebimento: this.formaRecebimento,
      observacoes: this.observacoes,
    };

    this.api.post('/receipts', payload).subscribe({
      next: () => {
        alert('Recebimento salvo com sucesso!');
        this.router.navigate(['/dashboard/receipts']);
      },
      error: (err) => {
        const message = err?.error?.message || 'Erro ao salvar recebimento.';
        alert(message);
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/dashboard/receipts']);
  }

  openReceiptMethodModal(): void {
    this.receiptMethodModalNome = '';
    this.receiptMethodModalFeedback = '';
    this.receiptMethodModalLoading = false;
    this.showReceiptMethodModal = true;
    setTimeout(() => {
      const input = document.getElementById('modal-receipt-method-nome') as HTMLInputElement | null;
      input?.focus();
    }, 0);
  }

  closeReceiptMethodModal(): void {
    this.resetReceiptMethodModal();
  }

  saveReceiptMethodFromModal(): void {
    const nome = this.receiptMethodModalNome.trim();

    if (nome.length < 2) {
      this.receiptMethodModalFeedback = 'Informe pelo menos 2 caracteres.';
      return;
    }

    this.receiptMethodModalLoading = true;
    this.receiptMethodModalFeedback = '';
    this.cdr.detectChanges();

    this.api.post<{ _id: string; nome: string }>('/receipt-methods', { nome }).subscribe({
      next: (created) => {
        this.zone.run(() => {
          this.receiptMethods = [...this.receiptMethods, created].sort((a, b) => a.nome.localeCompare(b.nome));
          this.receiptMethodModalLoading = false;
          this.showReceiptMethodModal = false;
          this.cdr.detectChanges();
          
          setTimeout(() => {
            this.formaRecebimento = created._id;
            this.cdr.detectChanges();
          }, 100);
        });
      },
      error: (err: any) => {
        this.zone.run(() => {
          const message = err?.error?.message || 'Erro ao salvar forma de recebimento.';
          this.receiptMethodModalFeedback = message === 'Forma de recebimento duplicada'
            ? 'Esta forma de recebimento já existe.'
            : message;
          this.receiptMethodModalLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  private resetReceiptMethodModal(): void {
    this.receiptMethodModalLoading = false;
    this.showReceiptMethodModal = false;
    this.receiptMethodModalNome = '';
    this.receiptMethodModalFeedback = '';
  }
}
