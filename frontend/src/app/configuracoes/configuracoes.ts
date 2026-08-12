import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../shared/sidebar/sidebar';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.css'
})
export class Configuracoes implements OnInit {
  // Modais
  modalPerfilAberto = false;
  modalNotificacoesAberto = false;
  modalTemaAberto = false;
  modalIdiomaAberto = false;
  modalSobreAberto = false;

  // Dados do usuário
  user: any = {};

  // Configurações
  notificacoes = {
    email: true,
    push: false,
    sms: false
  };

  temaSelecionado = 'claro';
  idiomaSelecionado = 'pt-BR';

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {
    // Carregar dados do usuário
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.user = user;
      }
    });
  }

  // Métodos para abrir modais
  abrirPerfil() {
    this.modalPerfilAberto = true;
  }

  abrirNotificacoes() {
    this.modalNotificacoesAberto = true;
  }

  abrirTema() {
    this.modalTemaAberto = true;
  }

  abrirIdioma() {
    this.modalIdiomaAberto = true;
  }

  abrirSobre() {
    this.modalSobreAberto = true;
  }

  // Fechar modais
  fecharModal() {
    this.modalPerfilAberto = false;
    this.modalNotificacoesAberto = false;
    this.modalTemaAberto = false;
    this.modalIdiomaAberto = false;
    this.modalSobreAberto = false;
  }

  // Salvar configurações
  salvarPerfil() {
    // Implementar salvamento do perfil
    console.log('Salvando perfil:', this.user);
    this.fecharModal();
  }

  salvarNotificacoes() {
    // Implementar salvamento das notificações
    console.log('Salvando notificações:', this.notificacoes);
    this.fecharModal();
  }

  salvarTema() {
    // Implementar mudança de tema
    console.log('Tema selecionado:', this.temaSelecionado);
    this.fecharModal();
  }

  salvarIdioma() {
    // Implementar mudança de idioma
    console.log('Idioma selecionado:', this.idiomaSelecionado);
    this.fecharModal();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}