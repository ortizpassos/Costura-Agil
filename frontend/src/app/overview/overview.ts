import { Component, inject, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-overview',
  imports: [],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class OverviewComponent {
  private router = inject(Router);

  // Evento para comunicar com o componente pai (financeiro)
  @Output() showModalEvent = new EventEmitter<void>();

  navigateToReports(type: string): void {
    // Em vez de navegar, emitir evento para mostrar modal
    this.showModalEvent.emit();
  }
}
