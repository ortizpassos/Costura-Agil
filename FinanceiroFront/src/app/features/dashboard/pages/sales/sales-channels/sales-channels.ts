import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';

interface SalesChannel {
  _id: string;
  nome: string;
}

@Component({
  selector: 'app-sales-channels',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './sales-channels.html',
  styleUrl: './sales-channels.css',
})
export class SalesChannelsComponent implements OnInit {
  readonly isLoading = signal(false);
  readonly feedback = signal('');

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  channels: SalesChannel[] = [];
  editingChannel: SalesChannel | null = null;

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
  });

  ngOnInit(): void {
    this.loadChannels();
  }

  loadChannels(): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.get<SalesChannel[]>('/sales-channels').subscribe({
      next: (list) => {
        this.channels = [...list].sort((a, b) => a.nome.localeCompare(b.nome));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || err?.message || 'Não foi possível carregar os canais de venda.';
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

    const nome = this.form.value.nome!.trim();

    if (this.editingChannel) {
      this.updateChannel(this.editingChannel._id, nome);
    } else {
      this.createChannel(nome);
    }
  }

  private createChannel(nome: string): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.post<SalesChannel>('/sales-channels', { nome }).subscribe({
      next: (channel) => {
        this.channels = [...this.channels, channel].sort((a, b) => a.nome.localeCompare(b.nome));
        this.form.reset();
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Erro ao criar canal de venda.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  private updateChannel(id: string, nome: string): void {
    this.isLoading.set(true);
    this.feedback.set('');

    this.api.put<SalesChannel>(`/sales-channels/${id}`, { nome }).subscribe({
      next: (updatedChannel) => {
        const index = this.channels.findIndex(c => c._id === id);
        if (index !== -1) {
          this.channels[index] = updatedChannel;
          this.channels = [...this.channels].sort((a, b) => a.nome.localeCompare(b.nome));
        }
        this.form.reset();
        this.editingChannel = null;
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Erro ao atualizar canal de venda.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  editChannel(channel: SalesChannel): void {
    this.editingChannel = channel;
    this.form.patchValue({ nome: channel.nome });
    this.feedback.set('');
  }

  deleteChannel(channel: SalesChannel): void {
    if (!confirm(`Tem certeza que deseja excluir o canal "${channel.nome}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.feedback.set('');

    this.api.delete(`/sales-channels/${channel._id}`).subscribe({
      next: () => {
        this.channels = this.channels.filter(c => c._id !== channel._id);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Erro ao excluir canal de venda.';
        this.feedback.set(message);
        this.isLoading.set(false);
      },
    });
  }

  trackByChannelId(index: number, channel: SalesChannel): string {
    return channel._id;
  }
}