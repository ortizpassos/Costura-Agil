import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-overview',
  imports: [],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class OverviewComponent {
  private router = inject(Router);

  navigateToReports(type: string): void {
    // Navegar para a página de relatórios com parâmetro de tipo
    this.router.navigate(['/dashboard/reports'], {
      queryParams: { type }
    });
  }
}
