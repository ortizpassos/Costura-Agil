import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../shared/sidebar/sidebar';
import { FooterComponent } from '../shared/footer/footer';
import { OverviewComponent } from "../overview/overview";

@Component({
  selector: 'app-financeiro',
  standalone: true,
  templateUrl: './financeiro.html',
  styleUrls: ['./financeiro.css'],
  imports: [CommonModule, SidebarComponent, OverviewComponent]
})
export class Financeiro {
  // Propriedades para controlar o modal
  showModal = false;
  modalTitle = 'Funcionalidade em Desenvolvimento';
  modalMessage = 'Esta funcionalidade está sendo desenvolvida e estará disponível em breve.';

  // Métodos para controlar o modal de desenvolvimento
  showDesenvolvimentoModal(): void {
    this.showModal = true;
  }

  hideDesenvolvimentoModal(): void {
    this.showModal = false;
  }
}
