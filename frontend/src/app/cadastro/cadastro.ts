import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UserRegistration } from '../models/user.model';

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro.html',
  styleUrls: ['./cadastro.css']
})
export class CadastroComponent {
  @Output() switchToLogin = new EventEmitter<void>();
  @Output() registerSuccess = new EventEmitter<void>();

  dadosCadastro: UserRegistration = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    document: ''
  };
  confirmarSenha = '';
  carregando = false;
  sucessoMsg = '';
  mostrarSenha = false;
  mostrarConfirmarSenha = false;
  erros: { [key: string]: string } = {};
  erroGeral = '';
  aceitarTermos = false;

  constructor(private authService: AuthService, private router: Router) {}

  togglePasswordVisibility() {
    this.mostrarSenha = !this.mostrarSenha;
  }
  toggleConfirmPasswordVisibility() {
    this.mostrarConfirmarSenha = !this.mostrarConfirmarSenha;
  }

  validarFormulario(): boolean {
    this.erros = {};
    if (!this.dadosCadastro.firstName) {
      this.erros['firstName'] = 'Informe o nome.';
    }
    if (!this.dadosCadastro.lastName) {
      this.erros['lastName'] = 'Informe o sobrenome.';
    }
    if (!this.dadosCadastro.email) {
      this.erros['email'] = 'Informe o e-mail.';
    }
    if (!this.dadosCadastro.password) {
      this.erros['password'] = 'Informe a senha.';
    }
    if (this.dadosCadastro.password !== this.confirmarSenha) {
      this.erros['confirmarSenha'] = 'As senhas não coincidem.';
    }
    return Object.keys(this.erros).length === 0;
  }

  onSubmit(): void {
    if (!this.validarFormulario()) {
      return;
    }
    this.carregando = true;
    this.erroGeral = '';
    // Monta objeto com campos esperados pelo backend
    const payload = {
      nome: `${this.dadosCadastro.firstName} ${this.dadosCadastro.lastName}`.trim(),
      email: this.dadosCadastro.email,
      senha: this.dadosCadastro.password
    };
    this.authService.register(payload).subscribe({
      next: (response) => {
        // Sucesso: backend retorna 201 ou objeto sem error
        this.sucessoMsg = 'Cadastro efetuado com sucesso!';
        this.erroGeral = '';
        this.carregando = false;
        setTimeout(() => {
          this.registerSuccess.emit();
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (err) => {
        // Erro: backend retorna error
        this.sucessoMsg = '';
        this.erroGeral = err.error?.message || 'Erro ao cadastrar';
        this.carregando = false;
      }
    });
  }

  onSwitchToLogin() {
    this.router.navigate(['/login']);
  }
}
