
import { Component, OnInit } from '@angular/core';
import { FuncionariosService, Funcionario } from '../services/funcionarios';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../shared/sidebar/sidebar';

@Component({
  selector: 'app-funcionarios',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './funcionarios.html',
  styleUrl: './funcionarios.css'
})
export class Funcionarios implements OnInit {
  funcionarios: Funcionario[] = [];
  modalAberto = false;
  funcionarioEditando: Funcionario | null = null;
  erroCadastro: string = '';
  form: any = {
    nome: '',
    codigo: '',
    funcao: '',
    ativo: true
  };

  constructor(private funcionariosService: FuncionariosService) {}

  ngOnInit() {
    this.carregarFuncionarios();
  }

  carregarFuncionarios() {
    this.funcionariosService.listarFuncionarios().subscribe({
      next: (data) => this.funcionarios = data
    });
  }

  abrirCadastro() {
    this.modalAberto = true;
    this.funcionarioEditando = null;
    this.form = {
      nome: '',
      codigo: '',
      funcao: '',
      ativo: true
    };
  }

  abrirEdicao(funcionario: Funcionario) {
    this.modalAberto = true;
    this.funcionarioEditando = funcionario;
    this.form = { ...funcionario };
  }

  fecharModal() {
    this.modalAberto = false;
    this.funcionarioEditando = null;
  }

  salvarFuncionario() {
    this.erroCadastro = '';
    if (this.funcionarioEditando) {
      // Editar
      this.funcionariosService.editarFuncionario(this.funcionarioEditando._id!, this.form).subscribe({
        next: () => {
          this.fecharModal();
          this.carregarFuncionarios();
        },
        error: () => {
          this.erroCadastro = 'Erro ao editar funcionário';
        }
      });
    } else {
      // Cadastrar
      this.funcionariosService.cadastrarFuncionario(this.form).subscribe({
        next: () => {
          this.fecharModal();
          this.carregarFuncionarios();
        },
        error: () => {
          this.erroCadastro = 'Erro ao cadastrar funcionário';
        }
      });
    }
  }

  excluirFuncionario(funcionario: Funcionario) {
    if (!confirm('Deseja realmente excluir este funcionário?')) return;
    this.funcionariosService.excluirFuncionario(funcionario._id!).subscribe({
      next: () => this.carregarFuncionarios(),
      error: () => alert('Erro ao excluir funcionário')
    });
  }
}