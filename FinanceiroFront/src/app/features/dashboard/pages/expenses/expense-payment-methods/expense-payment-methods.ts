import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';

interface PaymentMethod {
  _id: string;
  nome: string;
}

@Component({
  selector: 'app-expense-payment-methods',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './expense-payment-methods.html',
  styleUrl: './expense-payment-methods.css',
})
export class ExpensePaymentMethodsComponent implements OnInit {
  readonly isLoading = signal(false);
  readonly feedback = signal('');

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  methods: PaymentMethod[] = [];

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
  });

  ngOnInit(): void {
    this.loadMethods();
  }

  loadMethods(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.get<PaymentMethod[]>('/payment-methods').subscribe({
      next: (list) => {
        this.methods = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || err?.message || 'Não foi possível carregar as formas de pagamento.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const nome = this.form.value.nome?.trim();
    if (!nome) {
      this.feedback.set('Informe o nome da forma de pagamento.');
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    this.api.post<PaymentMethod>('/payment-methods', { nome }).subscribe({
      next: (created) => {
        this.methods = [...this.methods, created].sort((a, b) => a.nome.localeCompare(b.nome));
        this.form.reset();
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const apiMessage = err?.error?.message || err?.message;
        const message = apiMessage === 'Forma duplicada'
          ? 'Essa forma de pagamento já existe.'
          : apiMessage || 'Erro ao salvar forma de pagamento.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  delete(method: PaymentMethod): void {
    if (!confirm(`Remover a forma de pagamento "${method.nome}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    this.api.delete(`/payment-methods/${method._id}`).subscribe({
      next: () => {
        this.methods = this.methods.filter((item) => item._id !== method._id);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || err?.message || 'Erro ao remover forma de pagamento.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }
}
