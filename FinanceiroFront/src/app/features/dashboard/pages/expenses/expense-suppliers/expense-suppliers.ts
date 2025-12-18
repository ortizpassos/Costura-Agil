import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';

interface Supplier {
  _id: string;
  nome: string;
  contato?: string;
  telefone?: string;
  email?: string;
}

@Component({
  selector: 'app-expense-suppliers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './expense-suppliers.html',
  styleUrl: './expense-suppliers.css',
})
export class ExpenseSuppliersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly isLoading = signal(false);
  readonly feedback = signal('');

  suppliers: Supplier[] = [];

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    contato: [''],
    telefone: [''],
    email: ['', [Validators.email]],
  });

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.get<Supplier[]>('/suppliers').subscribe({
      next: (list) => {
        this.suppliers = list;
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.feedback.set(err?.message || 'Não foi possível carregar os fornecedores.');
        this.isLoading.set(false);
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      nome: this.form.value.nome?.trim(),
      contato: this.form.value.contato?.trim(),
      telefone: this.form.value.telefone?.trim(),
      email: this.form.value.email?.trim(),
    };

    if (!payload.nome) {
      this.feedback.set('Informe o nome do fornecedor.');
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    this.api.post<Supplier>('/suppliers', payload).subscribe({
      next: (created) => {
        this.suppliers = [...this.suppliers, created].sort((a, b) => a.nome.localeCompare(b.nome));
        this.form.reset();
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.message === 'Fornecedor duplicado'
          ? 'Este fornecedor já existe.'
          : err?.message || 'Erro ao salvar fornecedor.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  deleteSupplier(supplier: Supplier): void {
    if (!confirm(`Remover o fornecedor "${supplier.nome}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    this.api.delete(`/suppliers/${supplier._id}`).subscribe({
      next: () => {
        this.suppliers = this.suppliers.filter((item) => item._id !== supplier._id);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.feedback.set(err?.message || 'Erro ao remover fornecedor.');
        this.isLoading.set(false);
      },
    });
  }
}
