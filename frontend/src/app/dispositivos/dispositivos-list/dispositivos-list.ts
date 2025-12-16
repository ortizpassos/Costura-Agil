import { Component, OnInit } from '@angular/core';
import { DispositivosService, Dispositivo } from '../../services/dispositivos';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../shared/sidebar/sidebar';
import { SocketService } from '../../services/socket.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dispositivos-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './dispositivos-list.html',
  styleUrl: './dispositivos-list.css'
})
export class DispositivosList implements OnInit {
  dispositivos: Dispositivo[] = [];
  modalAberto = false;
  dispositivoEditando: Dispositivo | null = null;
  erroCadastro: string = '';
  form: any = {
    nome: '',
    deviceToken: '',
    operacao: '',
   
  };

  constructor(
    private dispositivosService: DispositivosService,
    private socketService: SocketService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.dispositivosService.listarDispositivos().subscribe({
      next: (data) => this.dispositivos = data
    });
    this.socketService.onDeviceStatusUpdate().subscribe((updated: any) => {
      if (!updated || !updated._id) return;
      const idx = this.dispositivos.findIndex(d => d._id === updated._id);
      if (idx !== -1) {
        this.dispositivos[idx] = { ...this.dispositivos[idx], ...updated };
      }
    });
  }

  abrirCadastro() {
    this.modalAberto = true;
    this.dispositivoEditando = null;
    this.form = {
      nome: '',
      deviceToken: ''
         
    };
  }

  abrirEdicao(dispositivo: Dispositivo) {
    this.modalAberto = true;
    this.dispositivoEditando = dispositivo;
    this.form = { ...dispositivo };
  }

  fecharModal() {
    this.modalAberto = false;
    this.dispositivoEditando = null;
  }

  salvarDispositivo() {
    this.erroCadastro = '';
    if (this.dispositivoEditando) {
      // Editar
      this.dispositivosService.editarDispositivo(this.dispositivoEditando._id!, this.form).subscribe({
        next: (data) => {
          const idx = this.dispositivos.findIndex(d => d._id === data._id);
          if (idx !== -1) this.dispositivos[idx] = data;
          this.fecharModal();
        },
        error: (err) => {
          this.erroCadastro = err?.error?.message || 'Erro ao editar dispositivo.';
        }
      });
    } else {
      // Cadastrar
      this.dispositivosService.cadastrarDispositivo(this.form).subscribe({
        next: (data) => {
          this.dispositivos.push(data);
          this.fecharModal();
        },
        error: (err) => {
          this.erroCadastro = err?.error?.message || 'Erro ao cadastrar dispositivo.';
        }
      });
    }
  }

  excluirDispositivo(dispositivo: Dispositivo) {
    if (!confirm('Deseja realmente excluir este dispositivo?')) return;
    this.dispositivosService.excluirDispositivo(dispositivo._id!).subscribe({
      next: () => {
        this.dispositivos = this.dispositivos.filter(d => d._id !== dispositivo._id);
      }
    });
  }
}
