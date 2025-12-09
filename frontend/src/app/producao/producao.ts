import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../shared/sidebar/sidebar';
import { SocketService } from '../services/socket.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { DispositivosService, Dispositivo } from '../services/dispositivos';
import { OperacoesService, Operacao } from '../services/operacoes';
import { ArtigosService, Artigo } from '../services/artigos';
import { ClientesService, Cliente } from '../services/clientes';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Subscription } from 'rxjs';

type ProducaoItem = Dispositivo & { progresso: number; funcionario: string; grupo: string; meta: number; };
type ArtigoForm = {
  codigo: string;
  nome: string;
  operacao: string;
  cliente: string;
  dataInclusao: string;
  valor: number | null;
  quantidade: number | null;
  status: string;
};

@Component({
  selector: 'app-producao',
  standalone: true,
  templateUrl: './producao.html',
  styleUrls: ['./producao.css'],
  imports: [CommonModule, FormsModule, SidebarComponent]
})
export class ProducaoComponent implements OnInit, OnDestroy {
  producao: ProducaoItem[] = [];
  producaoFiltrada: ProducaoItem[] = [];
  
  // Subscriptions para limpeza
  private subscriptions: Subscription[] = [];
  
  // Filtros e ordenação
  filtroStatus: string = 'todos';
  ordenacao: string = 'nome';
  busca: string = '';
  
  // Estatísticas
  totalProducaoHoje: number = 0;
  dispositivosAtivos: number = 0;
  metaTotal: number = 0;
  percentualMeta: number = 0;

  // Artigos, operações e clientes
  artigos: Artigo[] = [];
  operacoes: Operacao[] = [];
  clientes: Cliente[] = [];

  // Modal Artigo
  modalArtigoAberto: boolean = false;
  artigoEditando: Artigo | null = null;
  novoArtigo: ArtigoForm = this.criarArtigoPadrao();

  // Modais auxiliares
  modalOperacaoAberto: boolean = false;
  modalClienteAberto: boolean = false;
  operacaoEditando: Operacao | null = null;
  novaOperacao: any = { nome: '', metaDiaria: '', setor: '', descricao: '' };
  novoCliente: any = { nome: '', contato: '' };

  get producaoEmProducao(): ProducaoItem[] {
    return this.producao.filter(item => item.status === 'em_producao');
  }

  constructor(
    private dispositivosService: DispositivosService,
    private socketService: SocketService,
    private authService: AuthService,
    private router: Router,
    private artigosService: ArtigosService,
    private operacoesService: OperacoesService,
    private clientesService: ClientesService
  ) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.carregarDispositivos();
    this.configurarSocketListeners();
    this.carregarArtigos();
    this.carregarOperacoes();
    this.carregarClientes();
  }

  carregarArtigos() {
    this.artigosService.listarArtigos().subscribe({
      next: (arts: Artigo[]) => {
        this.artigos = arts;
      },
      error: (err: any) => { console.error('Erro ao buscar artigos', err); this.artigos = []; }
    });
  }

  carregarOperacoes() {
    this.operacoesService.listarOperacoes().subscribe({
      next: (ops: Operacao[]) => {
        this.operacoes = ops;
      },
      error: (err: any) => console.error('Erro ao buscar operações', err)
    });
  }

  carregarClientes() {
    this.clientesService.listarClientes().subscribe({
      next: (cls: Cliente[]) => {
        this.clientes = cls;
      },
      error: (err: any) => console.error('Erro ao buscar clientes', err)
    });
  }

  abrirModalArtigo() {
    this.modalArtigoAberto = true;
    this.artigoEditando = null;
    this.novoArtigo = this.criarArtigoPadrao();
  }
  fecharModalArtigo() {
    this.modalArtigoAberto = false;
    this.artigoEditando = null;
  }
  cadastrarArtigo() {
    const artigo = {
      codigo: this.novoArtigo.codigo,
      nome: this.novoArtigo.nome,
      operacao: this.novoArtigo.operacao,
      cliente: this.novoArtigo.cliente,
      dataInclusao: this.novoArtigo.dataInclusao,
      valor: Number(this.novoArtigo.valor ?? 0),
      quantidade: Number(this.novoArtigo.quantidade ?? 0),
      status: this.artigoEditando?.status || this.novoArtigo.status || 'pendente'
    };
    const requisicao = this.artigoEditando?._id
      ? this.artigosService.atualizarArtigo(this.artigoEditando._id, artigo)
      : this.artigosService.cadastrarArtigo(artigo);

    requisicao.subscribe({
      next: (artigoSalvo: Artigo) => {
        this.fecharModalArtigo();
        this.carregarArtigos();
        this.novoArtigo = this.criarArtigoPadrao();
        
        // Se for novo artigo (não está editando), perguntar se deseja colocar em produção
        if (!this.artigoEditando) {
          const colocarEmProducao = window.confirm(
            `Artigo "${artigoSalvo.nome}" cadastrado com sucesso!\n\nDeseja colocar este artigo em produção agora?`
          );
          
          if (colocarEmProducao && artigoSalvo._id) {
            this.iniciarProducaoArtigo(artigoSalvo);
          }
        }
        
        this.artigoEditando = null;
      },
      error: (err: any) => {
        alert('Erro ao salvar artigo!');
        console.error(err);
      }
    });
  }
  
  iniciarProducaoArtigo(artigo: Artigo) {
    if (!artigo._id) return;
    
    // Atualiza o status do artigo para "em_producao"
    this.artigosService.atualizarArtigo(artigo._id, { status: 'em_producao' }).subscribe({
      next: () => {
        this.carregarArtigos();
        alert(`Artigo "${artigo.nome}" agora está disponível para produção!`);
      },
      error: (err: any) => {
        console.error('Erro ao iniciar produção:', err);
        alert('Erro ao colocar artigo em produção!');
      }
    });
  }
  
  pausarProducaoArtigo(artigo: Artigo) {
    if (!artigo._id) return;
    
    const confirmar = window.confirm(`Deseja pausar a produção do artigo "${artigo.nome}"?\n\nOs funcionários não poderão mais selecionar este artigo.`);
    if (!confirmar) return;
    
    // Atualiza o status do artigo para "pausado"
    this.artigosService.atualizarArtigo(artigo._id, { status: 'pausado' }).subscribe({
      next: () => {
        this.carregarArtigos();
        alert(`Produção do artigo "${artigo.nome}" foi pausada.`);
      },
      error: (err: any) => {
        console.error('Erro ao pausar produção:', err);
        alert('Erro ao pausar produção do artigo!');
      }
    });
  }
  
  reabrirProducaoArtigo(artigo: Artigo) {
    // Abrir modal de edição com novo artigo baseado no finalizado
    this.artigoEditando = null; // Não é edição, é novo artigo
    this.novoArtigo = {
      codigo: artigo.codigo + '-R', // Adiciona sufixo -R (Reaberto)
      nome: artigo.nome,
      operacao: artigo.operacao,
      cliente: artigo.cliente,
      dataInclusao: new Date().toISOString().split('T')[0], // Data de hoje
      valor: artigo.valor ?? null,
      quantidade: artigo.quantidade ?? null,
      status: 'em_producao' // Novo artigo já começa em produção
    };
    this.modalArtigoAberto = true;
  }

  private criarArtigoPadrao(): ArtigoForm {
    const hoje = new Date().toISOString().split('T')[0];
    return {
      codigo: '',
      nome: '',
      operacao: '',
      cliente: '',
      dataInclusao: hoje,
      valor: null,
      quantidade: null,
      status: 'pendente'
    };
  }

  editarArtigo(artigo: Artigo) {
    this.artigoEditando = artigo;
    this.novoArtigo = {
      codigo: artigo.codigo,
      nome: artigo.nome,
      operacao: artigo.operacao,
      cliente: artigo.cliente,
      dataInclusao: artigo.dataInclusao?.substring(0, 10) || new Date().toISOString().split('T')[0],
      valor: artigo.valor ?? null,
      quantidade: artigo.quantidade ?? null,
      status: artigo.status || 'pendente'
    };
    this.modalArtigoAberto = true;
  }

  excluirArtigo(artigo: Artigo) {
    if (!artigo._id) {
      return;
    }
    const confirmar = window.confirm(`Deseja realmente remover o artigo "${artigo.nome}"?`);
    if (!confirmar) {
      return;
    }
    this.artigosService.excluirArtigo(artigo._id).subscribe({
      next: () => this.carregarArtigos(),
      error: (err: any) => {
        alert('Erro ao excluir artigo!');
        console.error(err);
      }
    });
  }

  gerarPdfArtigo(artigo: Artigo) {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(20);
    doc.setTextColor(13, 110, 253);
    doc.text('Informações do Artigo', 14, 22);
    
    // Linha separadora
    doc.setDrawColor(13, 110, 253);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 196, 28);
    
    let yPos = 40;
    
    // Informações gerais
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados Gerais', 14, yPos);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    yPos += 10;
    
    const dados = [
      ['Código:', artigo.codigo],
      ['Nome:', artigo.nome],
      ['Operação:', artigo.operacao],
      ['Cliente:', artigo.cliente],
      ['Data de Inclusão:', artigo.dataInclusao ? new Date(artigo.dataInclusao).toLocaleDateString('pt-BR') : '-'],
      ['Status:', this.formatarStatus(artigo.status)],
    ];
    
    dados.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 60, yPos);
      yPos += 8;
    });
    
    // Informações de produção
    yPos += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Produção', 14, yPos);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    yPos += 10;
    
    const quantidadeAtual = artigo.quantidadeAtual || 0;
    const quantidade = artigo.quantidade || 0;
    const percentual = quantidade > 0 ? Math.round((quantidadeAtual / quantidade) * 100) : 0;
    
    const producao = [
      ['Quantidade Meta:', String(quantidade)],
      ['Quantidade Produzida:', String(quantidadeAtual)],
      ['Percentual Concluído:', `${percentual}%`],
      ['Quantidade Restante:', String(Math.max(0, quantidade - quantidadeAtual))],
    ];
    
    producao.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 60, yPos);
      yPos += 8;
    });
    
    // Informações financeiras
    yPos += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Financeiro', 14, yPos);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    yPos += 10;
    
    const valorUnitario = artigo.valor || 0;
    const valorTotal = valorUnitario * quantidade;
    const valorProduzido = valorUnitario * quantidadeAtual;
    const valorPendente = valorTotal - valorProduzido;
    
    const financeiro = [
      ['Valor Unitário:', `R$ ${valorUnitario.toFixed(2)}`],
      ['Valor Total do Pedido:', `R$ ${valorTotal.toFixed(2)}`],
      ['Valor Produzido:', `R$ ${valorProduzido.toFixed(2)}`],
      ['Valor Pendente:', `R$ ${valorPendente.toFixed(2)}`],
    ];
    
    financeiro.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 60, yPos);
      yPos += 8;
    });
    
    // Rodapé
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      14,
      pageHeight - 10
    );
    
    // Salvar PDF
    const nomeArquivo = `artigo-${artigo.codigo}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);
  }

  abrirModalOperacao() {
    this.novaOperacao = { nome: '', metaDiaria: '', setor: '', descricao: '' };
    this.operacaoEditando = null;
    this.modalOperacaoAberto = true;
  }

  fecharModalOperacao() {
    this.modalOperacaoAberto = false;
  }

  cadastrarOperacao() {
    const op = {
      nome: this.novaOperacao.nome,
      metaDiaria: Number(this.novaOperacao.metaDiaria),
      setor: this.novaOperacao.setor,
      descricao: this.novaOperacao.descricao
    };
    this.operacoesService.cadastrarOperacao(op).subscribe({
      next: () => {
        this.fecharModalOperacao();
        this.carregarOperacoes();
        this.novaOperacao = { nome: '', metaDiaria: '', setor: '', descricao: '' };
      },
      error: (err: any) => {
        alert('Erro ao cadastrar operação!');
        console.error(err);
      }
    });
  }

  abrirModalCliente() {
    this.novoCliente = { nome: '', contato: '' };
    this.modalClienteAberto = true;
  }

  fecharModalCliente() {
    this.modalClienteAberto = false;
  }

  cadastrarCliente() {
    this.clientesService.cadastrarCliente({
      nome: this.novoCliente.nome,
      contato: this.novoCliente.contato
    }).subscribe({
      next: () => {
        this.fecharModalCliente();
        this.carregarClientes();
        this.novoCliente = { nome: '', contato: '' };
      },
      error: (err: any) => {
        alert('Erro ao cadastrar cliente!');
        console.error(err);
      }
    });
  }

  carregarDispositivos() {
    this.dispositivosService.listarDispositivos().subscribe((data: Dispositivo[]) => {
      this.producao = data.map((d: Dispositivo) => ({
        ...d,
        funcionario: d.funcionarioLogado?.nome || '-',
        progresso: d.producaoAtual || 0,
        grupo: d.setor || '-',
        meta: d.metaDiaria || 0,
      }));
      this.calcularEstatisticas();
      this.aplicarFiltros();
    });
  }

  configurarSocketListeners() {
    const deviceStatusSub = this.socketService.onDeviceStatusUpdate().subscribe((updated: any) => {
      if (!updated || !updated._id) return;
      const idx = this.producao.findIndex(p => p._id === updated._id);
      if (idx !== -1) {
        this.producao[idx] = {
          ...this.producao[idx],
          progresso: updated.producaoAtual || 0,
          funcionario: updated.funcionarioLogado?.nome || '-',
          status: updated.status || this.producao[idx].status,
        };
        this.calcularEstatisticas();
        this.aplicarFiltros();
      }
    });
    this.subscriptions.push(deviceStatusSub);
    
    const productionUpdateSub = this.socketService.onProductionUpdate?.().subscribe?.((payload: any) => {
      if (!payload?.dispositivo?._id) return;
      
      // Atualizar dispositivo
      const idx = this.producao.findIndex(p => p._id === payload.dispositivo._id);
      if (idx !== -1) {
        this.producao[idx] = {
          ...this.producao[idx],
          progresso: payload.dispositivo.producaoAtual || 0,
          funcionario: payload.dispositivo.funcionarioLogado?.nome || '-',
        };
        this.calcularEstatisticas();
        this.aplicarFiltros();
      }
      
      // Atualizar artigo em tempo real
      if (payload.dispositivo?.artigo?._id) {
        const artigoId = payload.dispositivo.artigo._id;
        const artigoIdx = this.artigos.findIndex(a => a._id === artigoId);
        
        if (artigoIdx !== -1) {
          // Atualizar quantidadeAtual do artigo
          this.artigos[artigoIdx] = {
            ...this.artigos[artigoIdx],
            quantidadeAtual: payload.dispositivo.artigo.quantidadeAtual || 0,
            status: payload.dispositivo.artigo.status || this.artigos[artigoIdx].status
          };
          
          console.log(`🔄 Artigo ${this.artigos[artigoIdx].nome} atualizado: ${this.artigos[artigoIdx].quantidadeAtual}/${this.artigos[artigoIdx].quantidade}`);
        }
      }
    });
    if (productionUpdateSub) {
      this.subscriptions.push(productionUpdateSub);
    }
  }
  
  ngOnDestroy() {
    // Limpar todas as subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  calcularEstatisticas() {
    this.totalProducaoHoje = this.producao.reduce((acc, item) => acc + (item.progresso || 0), 0);
    this.dispositivosAtivos = this.producao.filter(item => item.status === 'em_producao').length;
    this.metaTotal = this.producao.reduce((acc, item) => acc + (item.meta || 0), 0);
    this.percentualMeta = this.metaTotal > 0 ? Math.round((this.totalProducaoHoje / this.metaTotal) * 100) : 0;
  }

  aplicarFiltros() {
    let resultado = [...this.producao];
    
    // Filtro por status
    if (this.filtroStatus !== 'todos') {
      resultado = resultado.filter(item => item.status === this.filtroStatus);
    }
    
    // Filtro por busca
    if (this.busca.trim()) {
      const buscaLower = this.busca.toLowerCase();
      resultado = resultado.filter(item => 
        item.nome?.toLowerCase().includes(buscaLower) ||
        item.funcionario?.toLowerCase().includes(buscaLower) ||
        item.grupo?.toLowerCase().includes(buscaLower)
      );
    }
    
    this.producaoFiltrada = resultado;
    this.aplicarOrdenacao();
  }

  aplicarOrdenacao() {
    switch (this.ordenacao) {
      case 'nome':
        this.producaoFiltrada.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        break;
      case 'producao':
        this.producaoFiltrada.sort((a, b) => (b.progresso || 0) - (a.progresso || 0));
        break;
      case 'progresso':
        this.producaoFiltrada.sort((a, b) => {
          const percA = this.calcularPercentual(a.progresso, a.meta);
          const percB = this.calcularPercentual(b.progresso, b.meta);
          return percB - percA;
        });
        break;
      case 'funcionario':
        this.producaoFiltrada.sort((a, b) => (a.funcionario || '').localeCompare(b.funcionario || ''));
        break;
    }
  }

  obterClasseStatus(status?: string): string {
    switch (status) {
      case 'em_producao':
        return 'bg-info text-dark';
      case 'pausado':
        return 'bg-warning text-dark';
      case 'finalizado':
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  }

  formatarStatus(status?: string): string {
    const mapa: Record<string, string> = {
      pendente: 'Pendente',
      em_producao: 'Em produção',
      pausado: 'Pausado',
      finalizado: 'Finalizado'
    };
    return mapa[status || 'pendente'] || 'Pendente';
  }

  calcularPercentual(progresso: number, meta: number): number {
    if (!meta || meta === 0) return 0;
    return Math.min(Math.round((progresso / meta) * 100), 100);
  }
  
  calcularPercentualArtigo(artigo: Artigo): number {
    const atual = artigo.quantidadeAtual || 0;
    const total = artigo.quantidade || 0;
    if (total === 0) return 0;
    return Math.min(Math.round((atual / total) * 100), 100);
  }
  
  getProgressBarClass(percentual: number): string {
    if (percentual === 0) return 'bg-secondary';
    if (percentual < 30) return 'bg-danger';
    if (percentual < 70) return 'bg-warning';
    if (percentual < 100) return 'bg-info';
    return 'bg-success';
  }

  formatarDataHora(data: string | Date | undefined): string {
    if (!data || data === '-') return '-';
    const dt = new Date(data);
    if (isNaN(dt.getTime())) return '-';
    const dia = dt.getDate().toString().padStart(2, '0');
    const mes = (dt.getMonth() + 1).toString().padStart(2, '0');
    const ano = dt.getFullYear().toString().slice(-2);
    const hora = dt.getHours().toString().padStart(2, '0');
    const min = dt.getMinutes().toString().padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  }
}
