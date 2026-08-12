import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';

interface Account {
  _id: string;
  nome: string;
  tipo: string;
  saldoInicial: number;
  saldoAtual: number;
  ativo: boolean;
}

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './balance.html',
  styleUrl: './balance.css',
})
export class BalanceComponent implements OnInit {
  readonly isLoading = signal(false);
  readonly feedback = signal('');

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  accounts: Account[] = [];
  showAddModal = false;
  editingAccount: Account | null = null;

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    tipo: ['banco', [Validators.required]],
    saldoInicial: [0, [Validators.required, Validators.min(0)]]
  });

  balanceForm = this.fb.group({
    saldoAtual: [0, [Validators.required]]
  });

  // Propriedades para atualização de saldo
  showBalanceModal = false;
  selectedAccount: Account | null = null;

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.get<Account[]>('/accounts').subscribe({
      next: (accounts) => {
        this.accounts = accounts;
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Erro ao carregar contas.';
        this.feedback.set(message);
        this.isLoading.set(false);
      }
    });
  }

  openAddModal(): void {
    this.editingAccount = null;
    this.form.reset({ tipo: 'banco', saldoInicial: 0 });
    this.feedback.set('');
    this.showAddModal = true;
  }

  openEditModal(account: Account): void {
    this.editingAccount = account;
    this.form.patchValue({
      nome: account.nome,
      tipo: account.tipo,
      saldoInicial: account.saldoInicial
    });
    this.feedback.set('');
    this.showAddModal = true;
  }

  closeModal(): void {
    this.showAddModal = false;
    this.editingAccount = null;
    this.form.reset();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formData = this.form.value;

    if (this.editingAccount) {
      this.updateAccount(this.editingAccount._id, formData);
    } else {
      this.createAccount(formData);
    }
  }

  private createAccount(data: any): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.post<Account>('/accounts', data).subscribe({
      next: (account) => {
        this.accounts = [...this.accounts, account].sort((a, b) => a.nome.localeCompare(b.nome));
        this.closeModal();
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Erro ao criar conta.';
        this.feedback.set(message);
        this.isLoading.set(false);
      }
    });
  }

  private updateAccount(id: string, data: any): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.put<Account>(`/accounts/${id}`, data).subscribe({
      next: (account) => {
        const index = this.accounts.findIndex(a => a._id === id);
        if (index !== -1) {
          this.accounts[index] = account;
        }
        this.closeModal();
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Erro ao atualizar conta.';
        this.feedback.set(message);
        this.isLoading.set(false);
      }
    });
  }

  deleteAccount(account: Account): void {
    if (!confirm(`Tem certeza que deseja excluir a conta "${account.nome}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    this.api.delete(`/accounts/${account._id}`).subscribe({
      next: () => {
        this.accounts = this.accounts.filter(a => a._id !== account._id);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Erro ao excluir conta.';
        this.feedback.set(message);
        this.isLoading.set(false);
      }
    });
  }

  updateBalance(account: Account): void {
    this.selectedAccount = account;
    this.balanceForm.patchValue({
      saldoAtual: account.saldoAtual
    });
    this.showBalanceModal = true;
  }

  getTotalBalance(): number {
    return this.accounts.reduce((total, account) => total + account.saldoAtual, 0);
  }

  getAccountTypeLabel(tipo: string): string {
    const types = {
      'banco': 'Banco',
      'dinheiro': 'Dinheiro',
      'cartao': 'Cartão',
      'investimento': 'Investimento'
    };
    return types[tipo as keyof typeof types] || tipo;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  closeBalanceModal(): void {
    this.showBalanceModal = false;
    this.selectedAccount = null;
    this.balanceForm.reset();
    this.feedback.set('');
  }

  onUpdateBalance(): void {
    if (this.balanceForm.invalid || !this.selectedAccount) {
      this.feedback.set('Preencha todos os campos corretamente.');
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    const novoSaldo = this.balanceForm.value.saldoAtual;

    this.api.put(`accounts/${this.selectedAccount._id}/balance`, { saldoAtual: novoSaldo })
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);
          this.feedback.set('Saldo atualizado com sucesso!');
          this.closeBalanceModal();
          this.loadAccounts();
        },
        error: (error) => {
          this.isLoading.set(false);
          this.feedback.set(error.error?.message || 'Erro ao atualizar saldo.');
        }
      });
  }

  trackByAccountId(index: number, account: Account): string {
    return account._id;
  }
}
