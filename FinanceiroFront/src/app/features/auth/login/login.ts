import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  mode: 'login' | 'register' = 'login';
  name = '';
  email = '';
  password = '';
  error = '';
  isLoading = false;

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit() {
    // Verifica se a rota é /cadastro e define o modo como register
    if (this.router.url.includes('/cadastro')) {
      this.mode = 'register';
    }
  }

  toggleMode(event: Event) {
    event.preventDefault();
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.error = '';
  }

  async onSubmit() {
    this.error = '';
    if (!this.email || !this.password || (this.mode === 'register' && !this.name)) {
      this.error = 'Preencha todos os campos.';
      return;
    }

    this.isLoading = true;
    try {
      if (this.mode === 'register') {
        await this.authService.register({ name: this.name, email: this.email, password: this.password }).toPromise();
        // After register, login automatically or ask to login. 
        // The original code logs in automatically after register? 
        // Original code: await apiClient.post('/auth/register', ...); const data = await apiClient.post('/auth/login', ...);
        // So yes, it logs in after register.
      }
      
      this.authService.login({ email: this.email, password: this.password }).subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.error = err.message || 'Falha na autenticação';
          this.isLoading = false;
        }
      });
    } catch (err: any) {
      this.error = err.message || 'Erro ao registrar';
      this.isLoading = false;
    }
  }
}
