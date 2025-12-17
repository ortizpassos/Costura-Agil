import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SidebarComponent } from '../shared/sidebar/sidebar';
import { NfeService, Nfe } from '../services/nfe.service';

@Component({
  selector: 'app-nota-fiscal',
  standalone: true,
  templateUrl: './nota-fiscal.html',
  styleUrls: ['./nota-fiscal.css'],
  imports: [CommonModule, SidebarComponent]
})
export class NotaFiscal implements OnInit {
  nfeList: Nfe[] = [];
  loading = false;

  constructor(private nfeService: NfeService, private router: Router) { }

  ngOnInit(): void {
    this.loadNfe();
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
}
