
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  imports: [RouterModule, CommonModule]
})
export class SidebarComponent implements OnInit, OnDestroy {
  isOpen = false;
  private subscription: Subscription = new Subscription();

  constructor(public auth: AuthService, private sidebarService: SidebarService) {}

  ngOnInit() {
    this.subscription = this.sidebarService.sidebarOpen$.subscribe(isOpen => {
      this.isOpen = isOpen;
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  sair() {
    this.auth.logout();
    window.location.href = '/';
  }

  closeSidebar() {
    this.sidebarService.setSidebarOpen(false);
  }
}
