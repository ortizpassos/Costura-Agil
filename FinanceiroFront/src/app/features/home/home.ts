import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, Navbar],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home {
  year = new Date().getFullYear();
  isLoggedIn = false;

  constructor(private authService: AuthService) {
    this.isLoggedIn = this.authService.isAuthenticated();
  }
}
