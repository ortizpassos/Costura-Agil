import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NfeService, Nfe, NfeEstatisticas, NfeRecebida } from '../services/nfe.service';
import { GerarNfeComponent } from './gerar-nfe/gerar-nfe';
import { ConsultarNfeComponent } from './consultar-nfe/consultar-nfe';
import { SidebarComponent } from "../shared/sidebar/sidebar";

@Component({
  selector: 'app-nota-fiscal',
  standalone: true,
  templateUrl: './nota-fiscal.html',
  styleUrls: ['./nota-fiscal.css'],
  imports: [CommonModule, FormsModule, GerarNfeComponent, ConsultarNfeComponent, SidebarComponent]
})
export class NotaFiscal implements OnInit {
  nfeList: Nfe[] = [];
  notasRecebidas: NfeRecebida[] = [];
  loading = false;
  loadingRecebidas = false;
  activeTab = 'dashboard'; // Tab ativa
  configTab = 'geral'; // Sub-tab para configurações
  tributosTab = 'icms'; // Sub-tab para tributos
  showModal = false; // Modal de desenvolvimento
  estatisticas: NfeEstatisticas = {
    emitidas: 0,
    recebidas: 0,
    canceladas: 0,
    totalMensal: 0
  };

  // Filtros para consulta de notas recebidas
  dataInicio: string = '';
  dataFim: string = '';

  // Propriedades para formulários
  geralData = { cnpj: '', inscricaoEstadual: '', ambiente: 'homologacao', regimeTributario: 'simples' };
  icmsData = { regime: '', origem: '', tributacao: '' };
  ipiData = { cst: '', aliquota: '', enquadramento: '' };
  pisData = { cst: '', aliquota: '', tipoCalculo: 'percentual' };
  cofinsData = { cst: '', aliquota: '', tipoCalculo: 'percentual' };

  constructor(private nfeService: NfeService, private router: Router) { }

  ngOnInit(): void {
    this.loadNfe();
    this.loadEstatisticas();
    this.loadConfiguracoes();
    
    // Definir datas padrão para o filtro (últimos 30 dias)
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    
    this.dataFim = hoje.toISOString().split('T')[0];
    this.dataInicio = trintaDiasAtras.toISOString().split('T')[0];
  }

  loadNfe(): void {
    this.loading = true;
    this.nfeService.getNfe().subscribe({
      next: (data) => {
        this.nfeList = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar NFe:', error);
        this.loading = false;
      }
    });
  }

  loadEstatisticas(): void {
    this.nfeService.getEstatisticas().subscribe({
      next: (data) => {
        this.estatisticas = data;
      },
      error: (error) => {
        console.error('Erro ao carregar estatísticas:', error);
        // Valores padrão em caso de erro
        this.estatisticas = {
          emitidas: 0,
          recebidas: 0,
          canceladas: 0,
          totalMensal: 0
        };
      }
    });
  }

  deleteNfe(id: number): void {
    if (confirm('Tem certeza que deseja excluir esta nota fiscal?')) {
      this.nfeService.deleteNfe(id).subscribe({
        next: () => {
          this.loadNfe(); // Recarregar lista após exclusão
        },
        error: (error) => {
          console.error('Erro ao excluir NFe:', error);
        }
      });
    }
  }

  // Placeholder para futuras funcionalidades
  editNfe(nfe: Nfe): void {
    // TODO: Implementar edição
    console.log('Editar NFe:', nfe);
  }

  createNfe(): void {
    this.router.navigate(['/nota-fiscal/gerar']);
  }

  consultarNfe(): void {
    this.router.navigate(['/nota-fiscal/consultar']);
  }

  // Método para consultar notas recebidas
  consultarNotasRecebidas(): void {
    // Usar o CNPJ das configurações
    const cnpj = this.geralData.cnpj;
    
    if (!cnpj || cnpj.length !== 14) {
      alert('Configure o CNPJ nas configurações antes de consultar notas recebidas.');
      this.activeTab = 'config'; // Muda para a tab de configurações
      return;
    }

    this.loadingRecebidas = true;
    this.nfeService.consultarNotasRecebidas(cnpj, this.dataInicio, this.dataFim).subscribe({
      next: (data) => {
        this.notasRecebidas = data;
        this.loadingRecebidas = false;
      },
      error: (error) => {
        console.error('Erro ao consultar notas recebidas:', error);
        alert('Erro ao consultar notas recebidas: ' + error.message);
        this.loadingRecebidas = false;
      }
    });
  }

  // Método para consultar NFe por chave
  consultarNfePorChave(chave: string): void {
    // TODO: Implementar navegação para página de consulta individual
    console.log('Consultar NFe por chave:', chave);
    alert('Funcionalidade de consulta individual em desenvolvimento. Chave: ' + chave);
  }

  // Método para download do XML da NFe
  downloadXml(chave: string): void {
    // TODO: Implementar download do XML
    console.log('Download XML para chave:', chave);
    alert('Funcionalidade de download XML em desenvolvimento. Chave: ' + chave);
  }

  getStatusBadgeClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'autorizada':
      case 'aprovada':
        return 'bg-success';
      case 'rejeitada':
      case 'cancelada':
        return 'bg-danger';
      case 'pendente':
      case 'processando':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }

  // Métodos para controlar o modal de desenvolvimento
  showDesenvolvimentoModal(): void {
    this.showModal = true;
  }

  hideDesenvolvimentoModal(): void {
    this.showModal = false;
  }

  // Método para alterar a tab ativa
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Método para alterar a sub-tab de configurações
  setConfigTab(tab: string): void {
    this.configTab = tab;
  }

  // Método para alterar a sub-tab de tributos
  setTributosTab(tab: string): void {
    this.tributosTab = tab;
  }

  // Método para determinar o regime baseado no CNPJ
  getRegimeFromCNPJ(): string {
    // Lógica simplificada: em produção, consultar API ou base de dados
    // Por exemplo, verificar se o CNPJ está no Simples Nacional
    // Aqui, retornando um valor padrão para demonstração
    return 'Simples Nacional';
  }

  // Método para carregar configurações salvas
  loadConfiguracoes(): void {
    const geralConfig = localStorage.getItem('notaFiscalGeral');
    if (geralConfig) {
      this.geralData = { ...this.geralData, ...JSON.parse(geralConfig) };
    }

    const icmsConfig = localStorage.getItem('notaFiscalICMS');
    if (icmsConfig) {
      this.icmsData = { ...this.icmsData, ...JSON.parse(icmsConfig) };
    }

    const ipiConfig = localStorage.getItem('notaFiscalIPI');
    if (ipiConfig) {
      this.ipiData = { ...this.ipiData, ...JSON.parse(ipiConfig) };
    }

    const pisConfig = localStorage.getItem('notaFiscalPIS');
    if (pisConfig) {
      this.pisData = { ...this.pisData, ...JSON.parse(pisConfig) };
    }

    const cofinsConfig = localStorage.getItem('notaFiscalCOFINS');
    if (cofinsConfig) {
      this.cofinsData = { ...this.cofinsData, ...JSON.parse(cofinsConfig) };
    }
  }

  // Métodos para salvar configurações
  saveGeral(): void {
    localStorage.setItem('notaFiscalGeral', JSON.stringify(this.geralData));
    alert('Configurações gerais salvas com sucesso!');
  }

  saveICMS(): void {
    localStorage.setItem('notaFiscalICMS', JSON.stringify(this.icmsData));
    alert('Configurações ICMS salvas com sucesso!');
  }

  saveIPI(): void {
    localStorage.setItem('notaFiscalIPI', JSON.stringify(this.ipiData));
    alert('Configurações IPI salvas com sucesso!');
  }

  savePIS(): void {
    localStorage.setItem('notaFiscalPIS', JSON.stringify(this.pisData));
    alert('Configurações PIS salvas com sucesso!');
  }

  saveCOFINS(): void {
    localStorage.setItem('notaFiscalCOFINS', JSON.stringify(this.cofinsData));
    alert('Configurações COFINS salvas com sucesso!');
  }
}
