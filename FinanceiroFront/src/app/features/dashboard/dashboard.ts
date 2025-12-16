import { Router } from '@angular/router';

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SidebarComponent } from './sidebar/sidebar';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard {
  user: any;
  isSidebarOpen = false;


  constructor(private authService: AuthService, private router: Router) {
    this.authService.currentUser$.subscribe(u => this.user = u);
  }

  isOverviewRoute(): boolean {
    return this.router.url === '/dashboard/overview' || this.router.url === '/dashboard';
  }

  logout = () => {
    this.authService.logout();
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }
}
