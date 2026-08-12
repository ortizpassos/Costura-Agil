import { Component, Input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],  
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrls: ['../dashboard.css'],
  standalone: true
})
export class SidebarComponent {
  @Input() user: any;
  @Input() logout!: () => void;

  constructor(private router: Router) {}

  goToOverview() {
    this.router.navigate(['/dashboard/overview']);
  }
}
