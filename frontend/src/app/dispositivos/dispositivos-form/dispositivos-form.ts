
import { Component } from '@angular/core';
import { DispositivosService, Dispositivo } from '../../services/dispositivos';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dispositivos-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dispositivos-form.html',
  styleUrl: './dispositivos-form.css'
})
export class DispositivosForm {
  novoDispositivo: Dispositivo = { deviceToken: '', nome: '', metaDiaria: 0, operacao: '' };
  sucesso = false;
  erro = '';

  constructor(private dispositivosService: DispositivosService) {}

  cadastrarDispositivo() {
    this.dispositivosService.cadastrarDispositivo(this.novoDispositivo).subscribe({
      next: () => {
        this.sucesso = true;
        this.erro = '';
        this.novoDispositivo = { deviceToken: '', nome: '', metaDiaria: 0, operacao: '' };
      },
      error: (err) => {
        this.sucesso = false;
        this.erro = 'Erro ao cadastrar dispositivo';
      }
    });
  }
}
