import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';

interface ExpenseCategory {
  _id: string;
  nome: string;
}

@Component({
  selector: 'app-expense-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './expense-categories.html',
  styleUrl: './expense-categories.css',
})
export class ExpenseCategoriesComponent implements OnInit {
  readonly isLoading = signal(false);
  readonly feedback = signal('');
  categories: ExpenseCategory[] = [];
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.get<ExpenseCategory[]>('/categories').subscribe({
      next: (list) => {
        this.categories = list;
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.feedback.set(err?.message || 'Não foi possível carregar as categorias.');
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
      this.feedback.set('Informe o nome da categoria.');
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    this.api.post<ExpenseCategory>('/categories', { nome }).subscribe({
      next: (created) => {
        this.categories = [...this.categories, created].sort((a, b) => a.nome.localeCompare(b.nome));
        this.form.reset();
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.message === 'Categoria duplicada'
          ? 'Esta categoria já existe.'
          : err?.message || 'Erro ao salvar categoria.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  deleteCategory(category: ExpenseCategory): void {
    if (!confirm(`Remover a categoria "${category.nome}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    this.api.delete(`/categories/${category._id}`).subscribe({
      next: () => {
        this.categories = this.categories.filter((item) => item._id !== category._id);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.feedback.set(err?.message || 'Erro ao remover categoria.');
        this.isLoading.set(false);
      },
    });
  }
}
