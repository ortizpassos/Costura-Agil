import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class NavbarComponent {
  constructor(public router: Router, public auth: AuthService, private sidebarService: SidebarService) {}

  irParaLogin() {
    this.router.navigate(['/login']);
  }

  sair() {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  handleBrandClick(event: Event) {
    event.preventDefault();
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/']);
    }
  }

  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }
}
