import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';

@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './sale-form.html',
  styleUrl: './sale-form.css',
})
export class SaleFormComponent implements OnInit {

  salesChannels: Array<{ _id: string; nome: string }> = [];

  descricao = '';
  dataVenda = '';
  valor = '';
  canal = '';
  observacoes = '';

  showSalesChannelModal = false;
  salesChannelModalLoading = false;
  salesChannelModalFeedback = '';
  salesChannelModalNome = '';

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadSalesChannels();
    this.initializeFields();
  }

  private initializeFields(): void {
    this.dataVenda = new Date().toISOString().split('T')[0];
  }

  private loadSalesChannels(): void {
    this.api.get<Array<{ _id: string; nome: string }>>('/sales-channels').subscribe({
      next: (list) => {
        this.salesChannels = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
        this.cdr.detectChanges();
      },
      error: () => {
        // Se não existir endpoint, deixar vazio por enquanto
        this.salesChannels = [];
        this.cdr.detectChanges();
      }
    });
  }

  salvarVenda(): void {
    const valorNumerico = parseFloat(this.valor.replace('R$', '').replace('.', '').replace(',', '.').trim());

    if (!this.descricao.trim()) {
      alert('A descrição é obrigatória.');
      return;
    }
    if (!this.dataVenda) {
      alert('A data da venda é obrigatória.');
      return;
    }
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      alert('O valor da venda é obrigatório e deve ser maior que zero.');
      return;
    }

    const payload = {
      descricao: this.descricao,
      valor: valorNumerico,
      dataVenda: this.dataVenda,
      canal: this.canal,
      observacoes: this.observacoes,
    };

    this.api.post('/sales', payload).subscribe({
      next: () => {
        alert('Venda salva com sucesso!');
        this.router.navigate(['/dashboard/sales']);
      },
      error: (err) => {
        const message = err?.error?.message || 'Erro ao salvar venda.';
        alert(message);
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/dashboard/sales']);
  }

  openSalesChannelModal(): void {
    this.salesChannelModalNome = '';
    this.salesChannelModalFeedback = '';
    this.salesChannelModalLoading = false;
    this.showSalesChannelModal = true;
    setTimeout(() => {
      const input = document.getElementById('modal-sales-channel-nome') as HTMLInputElement | null;
      input?.focus();
    }, 0);
  }

  closeSalesChannelModal(): void {
    this.resetSalesChannelModal();
  }

  saveSalesChannelFromModal(): void {
    const nome = this.salesChannelModalNome.trim();

    if (nome.length < 2) {
      this.salesChannelModalFeedback = 'Informe pelo menos 2 caracteres.';
      return;
    }

    this.salesChannelModalLoading = true;
    this.salesChannelModalFeedback = '';
    this.cdr.detectChanges();

    this.api.post<{ _id: string; nome: string }>('/sales-channels', { nome }).subscribe({
      next: (created) => {
        this.zone.run(() => {
          this.salesChannels = [...this.salesChannels, created].sort((a, b) => a.nome.localeCompare(b.nome));
          this.salesChannelModalLoading = false;
          this.showSalesChannelModal = false;
          this.cdr.detectChanges();

          setTimeout(() => {
            this.canal = created._id;
            this.cdr.detectChanges();
          }, 100);
        });
      },
      error: (err: any) => {
        this.zone.run(() => {
          const message = err?.error?.message || 'Erro ao salvar canal de venda.';
          this.salesChannelModalFeedback = message === 'Canal de venda duplicado'
            ? 'Este canal de venda já existe.'
            : message;
          this.salesChannelModalLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  private resetSalesChannelModal(): void {
    this.salesChannelModalLoading = false;
    this.showSalesChannelModal = false;
    this.salesChannelModalNome = '';
    this.salesChannelModalFeedback = '';
  }
}
