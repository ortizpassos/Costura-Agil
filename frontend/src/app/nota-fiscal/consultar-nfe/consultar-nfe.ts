import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NfeService, NfeResponse } from '../../services/nfe.service';

interface NfeDetalhes {
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  dataAutorizacao?: string;
  modelo: string;
  tipoOperacao: string;
  finalidade: string;
  status: string;
  protocolo?: string;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia?: string;
    endereco: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  destinatario: {
    cnpj: string;
    razaoSocial: string;
    endereco: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  produtos: Array<{
    codigo: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    cfop: string;
    ncm: string;
  }>;
  totais: {
    valorProdutos: number;
    valorICMS: number;
    valorIPI: number;
    valorPIS: number;
    valorCOFINS: number;
    valorTotal: number;
  };
}

@Component({
  selector: 'app-consultar-nfe',
  standalone: true,
  templateUrl: './consultar-nfe.html',
  styleUrls: ['./consultar-nfe.scss'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class ConsultarNfeComponent {
  consultaForm: FormGroup;
  nfeDetalhes: NfeDetalhes | null = null;
  loading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private nfeService: NfeService,
    private router: Router
  ) {
    this.consultaForm = this.fb.group({
      chave: ['', [Validators.required, Validators.pattern(/^\d{44}$/)]]
    });
  }

  onSubmit(): void {
    if (this.consultaForm.valid) {
      this.loading = true;
      this.successMessage = '';
      this.errorMessage = '';
      this.nfeDetalhes = null;

      const chave = this.consultaForm.value.chave;

      this.nfeService.consultarNfe(chave).subscribe({
        next: (response: NfeResponse) => {
          this.loading = false;
          if (response.result) {
            this.successMessage = 'NFe consultada com sucesso!';
            // Em um cenário real, o response.result conteria os detalhes da NFe
            // Por enquanto, vamos simular alguns dados
            this.nfeDetalhes = this.simularDetalhesNfe(chave);
          } else if (response.error) {
            this.errorMessage = response.error;
          }
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = 'Erro ao consultar NFe: ' + (error.error?.error || error.message);
        }
      });
    } else {
      this.errorMessage = 'Chave de acesso inválida. Deve conter 44 dígitos.';
    }
  }

  private simularDetalhesNfe(chave: string): NfeDetalhes {
    // Simulação de dados - em produção, isso viria da API
    return {
      chave: chave,
      numero: chave.substring(25, 34),
      serie: chave.substring(22, 25),
      dataEmissao: '2024-12-17T10:00:00',
      dataAutorizacao: '2024-12-17T10:05:00',
      modelo: '55',
      tipoOperacao: '1',
      finalidade: '1',
      status: 'Autorizada',
      protocolo: '123456789012345',
      emitente: {
        cnpj: '12345678000123',
        razaoSocial: 'Empresa Exemplo Ltda',
        nomeFantasia: 'Empresa Exemplo',
        endereco: 'Rua das Flores, 123',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01234567'
      },
      destinatario: {
        cnpj: '98765432000198',
        razaoSocial: 'Cliente Exemplo Ltda',
        endereco: 'Av. Paulista, 456',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01310999'
      },
      produtos: [
        {
          codigo: '001',
          descricao: 'Produto de Exemplo',
          quantidade: 10,
          valorUnitario: 50.00,
          valorTotal: 500.00,
          cfop: '5102',
          ncm: '61091000'
        }
      ],
      totais: {
        valorProdutos: 500.00,
        valorICMS: 90.00,
        valorIPI: 0.00,
        valorPIS: 2.75,
        valorCOFINS: 12.65,
        valorTotal: 500.00
      }
    };
  }

  voltar(): void {
    this.router.navigate(['/nota-fiscal']);
  }

  limpar(): void {
    this.consultaForm.reset();
    this.nfeDetalhes = null;
    this.successMessage = '';
    this.errorMessage = '';
  }
}
