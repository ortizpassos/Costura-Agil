import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NfeService, Nfe, NfeEstatisticas } from '../services/nfe.service';
import { GerarNfeComponent } from './gerar-nfe/gerar-nfe';
import { ConsultarNfeComponent } from './consultar-nfe/consultar-nfe';
import { SidebarComponent } from "../shared/sidebar/sidebar";

@Component({
  selector: 'app-nota-fiscal',
  standalone: true,
  templateUrl: './nota-fiscal.html',
  styleUrls: ['./nota-fiscal.css'],
  imports: [CommonModule, GerarNfeComponent, ConsultarNfeComponent, SidebarComponent]
})
export class NotaFiscal implements OnInit {
  nfeList: Nfe[] = [];
  loading = false;
  estatisticas: NfeEstatisticas = {
    emitidas: 0,
    recebidas: 0,
    canceladas: 0,
    totalMensal: 0
  };

  // Propriedades para controlar o modal
  showModal = false;
  modalTitle = 'Funcionalidade em Desenvolvimento';
  modalMessage = 'Esta funcionalidade está sendo desenvolvida e estará disponível em breve.';

  constructor(private nfeService: NfeService, private router: Router) { }

  ngOnInit(): void {
    this.loadNfe();
    this.loadEstatisticas();
  }

  loadNfe(): void {
    this.loading = true;
    this.nfeService.getNfe().subscribe({
      next: (data) => {
        this.nfeList = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar NFe:', error);
        this.loading = false;
      }
    });
  }

  loadEstatisticas(): void {
    this.nfeService.getEstatisticas().subscribe({
      next: (data) => {
        this.estatisticas = data;
      },
      error: (error) => {
        console.error('Erro ao carregar estatísticas:', error);
        // Valores padrão em caso de erro
        this.estatisticas = {
          emitidas: 0,
          recebidas: 0,
          canceladas: 0,
          totalMensal: 0
        };
      }
    });
  }

  deleteNfe(id: number): void {
    if (confirm('Tem certeza que deseja excluir esta nota fiscal?')) {
      this.nfeService.deleteNfe(id).subscribe({
        next: () => {
          this.loadNfe(); // Recarregar lista após exclusão
        },
        error: (error) => {
          console.error('Erro ao excluir NFe:', error);
        }
      });
    }
  }

  // Placeholder para futuras funcionalidades
  editNfe(nfe: Nfe): void {
    // TODO: Implementar edição
    console.log('Editar NFe:', nfe);
  }

  createNfe(): void {
    this.router.navigate(['/nota-fiscal/gerar']);
  }

  consultarNfe(): void {
    this.router.navigate(['/nota-fiscal/consultar']);
  }

  getStatusBadgeClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'autorizada':
      case 'aprovada':
        return 'bg-success';
      case 'rejeitada':
      case 'cancelada':
        return 'bg-danger';
      case 'pendente':
      case 'processando':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }

  // Métodos para controlar o modal de desenvolvimento
  showDesenvolvimentoModal(): void {
    this.showModal = true;
  }

  hideDesenvolvimentoModal(): void {
    this.showModal = false;
  }
}
