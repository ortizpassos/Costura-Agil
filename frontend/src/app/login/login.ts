import { Component, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UserLogin } from '../models/user.model';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnChanges {
  @Output() switchToRegister = new EventEmitter<void>();
  @Output() loginSuccess = new EventEmitter<void>();
  successMessage = '';
  showSuccess = false;

  dadosLogin: UserLogin = {
    email: '',
    password: ''
  };
  carregando = false;
  mostrarSenha = false;
  erros: { [key: string]: string } = {};
  erroGeral = '';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['successMessage']) {
      const val = this.successMessage;
      this.showSuccess = !!val;
      if (this.showSuccess) {
        setTimeout(() => {
          this.showSuccess = false;
        }, 5000);
      }
    }
  }

  togglePasswordVisibility() {
    this.mostrarSenha = !this.mostrarSenha;
  }

  validarFormulario(): boolean {
    this.erros = {};
    if (!this.dadosLogin.email) {
      this.erros['email'] = 'Informe o e-mail.';
    }
    if (!this.dadosLogin.password) {
      this.erros['password'] = 'Informe a senha.';
    }
    return Object.keys(this.erros).length === 0;
  }

  onSubmit(): void {
    if (this.showSuccess) this.showSuccess = false;
    if (!this.validarFormulario()) {
      return;
    }
    this.carregando = true;
    this.erroGeral = '';
    const payload = {
      email: this.dadosLogin.email,
      senha: this.dadosLogin.password
    };
    this.authService.login(payload).subscribe({
      next: (response) => {
        if (response.success) {
          this.loginSuccess.emit();
          // Verificar se é admin
          if (response.data?.user.role === 'admin') {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        } else {
          this.erroGeral = response.error?.message || 'Erro ao fazer login';
        }
        this.carregando = false;
      },
      error: (err) => {
        this.erroGeral = err.error?.message || 'Erro ao autenticar';
        this.carregando = false;
      }
    });
  }

  onSwitchToRegister() {
    this.router.navigate(['/cadastro']);
  }
  onForgotPassword() {
    // Implementar fluxo de recuperação de senha se necessário
  }
}
