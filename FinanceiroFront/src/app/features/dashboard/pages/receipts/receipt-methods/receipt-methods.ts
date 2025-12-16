import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';

interface ReceiptMethod {
  _id: string;
  nome: string;
}

@Component({
  selector: 'app-receipt-methods',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './receipt-methods.html',
  styleUrl: './receipt-methods.css',
})
export class ReceiptMethodsComponent implements OnInit {
  readonly isLoading = signal(false);
  readonly feedback = signal('');

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  methods: ReceiptMethod[] = [];

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
  });

  ngOnInit(): void {
    this.loadMethods();
  }

  loadMethods(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.get<ReceiptMethod[]>('/receipt-methods').subscribe({
      next: (list) => {
        this.methods = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || err?.message || 'Não foi possível carregar as formas de recebimento.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nome } = this.form.value;
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.post<ReceiptMethod>('/receipt-methods', { nome }).subscribe({
      next: (created) => {
        this.methods = [...this.methods, created].sort((a, b) => a.nome.localeCompare(b.nome));
        this.form.reset();
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || err?.message || 'Não foi possível salvar a forma de recebimento.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  deleteMethod(method: ReceiptMethod): void {
    if (!confirm(`Tem certeza que deseja excluir "${method.nome}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    this.api.delete(`/receipt-methods/${method._id}`).subscribe({
      next: () => {
        this.methods = this.methods.filter(m => m._id !== method._id);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || err?.message || 'Não foi possível excluir a forma de recebimento.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo é obrigatório.';
    }
    if (field?.hasError('minlength')) {
      return 'Mínimo de 2 caracteres.';
    }
    if (field?.hasError('maxlength')) {
      return 'Máximo de 60 caracteres.';
    }
    return '';
  }
}