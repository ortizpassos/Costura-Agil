import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';

import { SidebarComponent } from '../shared/sidebar/sidebar';
import { SocketService } from '../services/socket.service';
import { AuthService } from '../services/auth.service';
import {
  DispositivosService,
  Dispositivo
} from '../services/dispositivos';
import {
  OperacoesService,
  Operacao
} from '../services/operacoes';
import {
  ArtigosService,
  Artigo,
  RFIDScanStatus
} from '../services/artigos';
import {
  ClientesService,
  Cliente
} from '../services/clientes';

type ProducaoItem = Dispositivo & {
  progresso: number;
  funcionario: string;
  meta: number;
};

type ArtigoForm = {
  codigo: string;
  nome: string;
  operacao: string;
  cliente: string;
  dataInclusao: string;
  valor: number | null;
  quantidade: number | null;
  status: string;
  rfidEnabled: boolean;
};

@Component({
  selector: 'app-producao',
  standalone: true,
  templateUrl: './producao.html',
  styleUrls: ['./producao.css'],
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent
  ]
})
export class ProducaoComponent
  implements OnInit, OnDestroy {

  producao: ProducaoItem[] = [];
  producaoFiltrada: ProducaoItem[] = [];

  artigos: Artigo[] = [];
  operacoes: Operacao[] = [];
  clientes: Cliente[] = [];

  totalProducaoHoje = 0;
  dispositivosAtivos = 0;
  metaTotal = 0;
  percentualMeta = 0;

  filtroStatus = 'todos';
  busca = '';

  modalArtigoAberto = false;
  modalOperacaoAberto = false;
  modalClienteAberto = false;
  modalRFIDAberto = false;

  artigoEditando: Artigo | null = null;
  artigoRFIDSelecionado: Artigo | null = null;

  novoArtigo: ArtigoForm =
    this.criarArtigoPadrao();

  novaOperacao: any = {
    nome: '',
    pecasPorHora: 1,
    cortesPorPeca: 0,
    descricao: ''
  };

  novoCliente: any = {
    nome: '',
    contato: ''
  };

  rfidCarregando = false;
  rfidEtiquetasCadastradas = 0;
  rfidEtiquetasRevisadas = 0;
  rfidQuantidade = 0;
  rfidScanStatus: RFIDScanStatus =
    'nao_aplicavel';

  private subscriptions: Subscription[] = [];
  private userId: string | null = null;

  constructor(
    private socketService: SocketService,
    private authService: AuthService,
    private router: Router,
    private dispositivosService: DispositivosService,
    private operacoesService: OperacoesService,
    private artigosService: ArtigosService,
    private clientesService: ClientesService
  ) {}

  ngOnInit(): void {
    const usuario: any =
      this.authService.getUsuario?.();

    this.userId =
      usuario?._id ||
      usuario?.id ||
      null;

    this.carregarTudo();
    this.configurarSocket();

    // Atualiza o modal RFID automaticamente enquanto estiver aberto.
    const poll = interval(2000).subscribe(() => {
      if (
        this.modalRFIDAberto &&
        this.artigoRFIDSelecionado?._id &&
        this.rfidScanStatus === 'em_leitura'
      ) {
        this.carregarStatusRFID(false);
      }
    });

    this.subscriptions.push(poll);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(
      (sub) => sub.unsubscribe()
    );
  }

  carregarTudo(): void {
    this.carregarArtigos();
    this.carregarOperacoes();
    this.carregarClientes();
    this.carregarDispositivos();
  }

  carregarArtigos(): void {
    this.artigosService
      .listarArtigos()
      .subscribe({
        next: (artigos) => {
          this.artigos = Array.isArray(artigos)
            ? artigos
            : [];
        },
        error: (err) => {
          console.error(
            'Erro ao buscar artigos',
            err
          );
          this.artigos = [];
        }
      });
  }

  carregarOperacoes(): void {
    this.operacoesService
      .listarOperacoes()
      .subscribe({
        next: (ops) => {
          this.operacoes = ops || [];
        },
        error: (err) =>
          console.error(
            'Erro ao buscar operações',
            err
          )
      });
  }

  carregarClientes(): void {
    this.clientesService
      .listarClientes()
      .subscribe({
        next: (clientes) => {
          this.clientes = clientes || [];
        },
        error: (err) =>
          console.error(
            'Erro ao buscar clientes',
            err
          )
      });
  }

  carregarDispositivos(): void {
    this.dispositivosService
      .listarDispositivos()
      .subscribe({
        next: (dispositivos: Dispositivo[]) => {
          this.producao =
            (dispositivos || [])
              .map((d: any) => ({
                ...d,
                progresso:
                  d.producaoAtual || 0,
                funcionario:
                  d.funcionarioLogado?.nome ||
                  '-',
                meta:
                  d.artigo?.quantidade ||
                  d.meta ||
                  0
              }));

          this.calcularEstatisticas();
          this.aplicarFiltros();
        },
        error: (err) =>
          console.error(
            'Erro ao carregar dispositivos',
            err
          )
      });
  }

  configurarSocket(): void {
    const statusSub =
      this.socketService
        .onDeviceStatusUpdate?.()
        .subscribe?.((updated: any) => {
          if (!updated?._id) return;

          const idx =
            this.producao.findIndex(
              (p: any) =>
                p._id === updated._id
            );

          if (idx >= 0) {
            this.producao[idx] = {
              ...this.producao[idx],
              ...updated,
              progresso:
                updated.producaoAtual ||
                this.producao[idx].progresso ||
                0,
              funcionario:
                updated.funcionarioLogado?.nome ||
                this.producao[idx].funcionario ||
                '-',
              meta:
                updated.artigo?.quantidade ||
                this.producao[idx].meta ||
                0
            };
          } else {
            this.producao.push({
              ...updated,
              progresso:
                updated.producaoAtual || 0,
              funcionario:
                updated.funcionarioLogado?.nome ||
                '-',
              meta:
                updated.artigo?.quantidade ||
                0
            });
          }

          this.calcularEstatisticas();
          this.aplicarFiltros();
        });

    if (statusSub) {
      this.subscriptions.push(statusSub);
    }

    const prodSub =
      this.socketService
        .onProductionUpdate?.()
        .subscribe?.((payload: any) => {
          const dispositivo =
            payload?.dispositivo;

          if (!dispositivo?._id) return;

          const idx =
            this.producao.findIndex(
              (p: any) =>
                p._id === dispositivo._id
            );

          if (idx >= 0) {
            this.producao[idx] = {
              ...this.producao[idx],
              ...dispositivo,
              progresso:
                dispositivo.producaoAtual ||
                0,
              funcionario:
                dispositivo
                  .funcionarioLogado
                  ?.nome || '-',
              meta:
                dispositivo.artigo
                  ?.quantidade || 0
            };
          }

          if (dispositivo.artigo?._id) {
            const artigoIndex =
              this.artigos.findIndex(
                (a) =>
                  a._id ===
                  dispositivo.artigo._id
              );

            if (artigoIndex >= 0) {
              this.artigos[artigoIndex] = {
                ...this.artigos[artigoIndex],
                quantidadeAtual:
                  dispositivo.artigo
                    .quantidadeAtual || 0,
                status:
                  dispositivo.artigo.status ||
                  this.artigos[artigoIndex]
                    .status
              };
            }
          }

          this.calcularEstatisticas();
          this.aplicarFiltros();
        });

    if (prodSub) {
      this.subscriptions.push(prodSub);
    }
  }

  aplicarFiltros(): void {
    const termo =
      this.busca.trim().toLowerCase();

    this.producaoFiltrada =
      this.producao.filter(
        (item: any) => {
          const statusOk =
            this.filtroStatus === 'todos' ||
            item.status ===
              this.filtroStatus;

          const texto =
            [
              item.nome,
              item.deviceToken,
              item.funcionario,
              item.artigo?.nome,
              item.artigo?.codigo
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          const buscaOk =
            !termo ||
            texto.includes(termo);

          return statusOk && buscaOk;
        }
      );
  }

  calcularEstatisticas(): void {
    this.totalProducaoHoje =
      this.producao.reduce(
        (soma, item) =>
          soma +
          (item.progresso || 0),
        0
      );

    this.dispositivosAtivos =
      this.producao.filter(
        (item: any) =>
          item.status === 'em_producao' ||
          item.status === 'online'
      ).length;

    this.metaTotal =
      this.producao.reduce(
        (soma, item) =>
          soma +
          (item.meta || 0),
        0
      );

    this.percentualMeta =
      this.metaTotal > 0
        ? Math.round(
            (this.totalProducaoHoje /
              this.metaTotal) *
              100
          )
        : 0;
  }

  abrirModalArtigo(): void {
    this.artigoEditando = null;
    this.novoArtigo =
      this.criarArtigoPadrao();
    this.modalArtigoAberto = true;
  }

  fecharModalArtigo(): void {
    this.modalArtigoAberto = false;
    this.artigoEditando = null;
  }

  editarArtigo(artigo: Artigo): void {
    this.artigoEditando = artigo;

    this.novoArtigo = {
      codigo: artigo.codigo,
      nome: artigo.nome,
      operacao: artigo.operacao,
      cliente: artigo.cliente,
      dataInclusao:
        artigo.dataInclusao
          ?.substring(0, 10) ||
        new Date()
          .toISOString()
          .substring(0, 10),
      valor: artigo.valor,
      quantidade: artigo.quantidade,
      status:
        artigo.status ||
        'pendente',
      rfidEnabled:
        artigo.rfidEnabled === true
    };

    this.modalArtigoAberto = true;
  }

  cadastrarArtigo(): void {
    const editando =
      !!this.artigoEditando?._id;

    const payload: Partial<Artigo> = {
      codigo:
        this.novoArtigo.codigo.trim(),
      nome:
        this.novoArtigo.nome.trim(),
      operacao:
        this.novoArtigo.operacao.trim(),
      cliente:
        this.novoArtigo.cliente.trim(),
      dataInclusao:
        this.novoArtigo.dataInclusao,
      valor:
        Number(
          this.novoArtigo.valor || 0
        ),
      quantidade:
        Number(
          this.novoArtigo.quantidade || 0
        ),
      status:
        this.artigoEditando?.status ||
        this.novoArtigo.status ||
        'pendente',
      rfidEnabled:
        this.novoArtigo.rfidEnabled === true
    };

    const request =
      editando &&
      this.artigoEditando?._id
        ? this.artigosService
            .atualizarArtigo(
              this.artigoEditando._id,
              payload
            )
        : this.artigosService
            .cadastrarArtigo(payload);

    request.subscribe({
      next: (artigoSalvo) => {
        const novoCadastro = !editando;
        const abrirRFID =
          novoCadastro &&
          artigoSalvo.rfidEnabled === true;

        this.fecharModalArtigo();
        this.novoArtigo =
          this.criarArtigoPadrao();
        this.carregarArtigos();

        if (abrirRFID) {
          this.abrirModalRFID(
            artigoSalvo
          );
          return;
        }

        if (novoCadastro) {
          const iniciar =
            window.confirm(
              `Artigo "${artigoSalvo.nome}" cadastrado com sucesso!\n\n` +
              `Deseja colocar este artigo em produção agora?`
            );

          if (iniciar) {
            this.iniciarProducaoArtigo(
              artigoSalvo
            );
          }
        }
      },
      error: (err) => {
        console.error(err);

        alert(
          err?.error?.message ||
          'Erro ao salvar artigo.'
        );
      }
    });
  }

  excluirArtigo(artigo: Artigo): void {
    if (!artigo._id) return;

    const ok =
      window.confirm(
        `Excluir o artigo "${artigo.nome}"?`
      );

    if (!ok) return;

    this.artigosService
      .excluirArtigo(artigo._id)
      .subscribe({
        next: () =>
          this.carregarArtigos(),
        error: (err) => {
          console.error(err);
          alert(
            err?.error?.message ||
            'Erro ao excluir artigo.'
          );
        }
      });
  }

  iniciarProducaoArtigo(
    artigo: Artigo
  ): void {
    if (!artigo._id) return;

    this.artigosService
      .atualizarArtigo(
        artigo._id,
        { status: 'em_producao' }
      )
      .subscribe({
        next: () =>
          this.carregarArtigos(),
        error: (err) => {
          console.error(err);
          alert(
            'Erro ao iniciar produção.'
          );
        }
      });
  }

  pausarArtigo(artigo: Artigo): void {
    if (!artigo._id) return;

    this.artigosService
      .atualizarArtigo(
        artigo._id,
        { status: 'pausado' }
      )
      .subscribe({
        next: () =>
          this.carregarArtigos(),
        error: (err) =>
          console.error(err)
      });
  }

  reabrirProducaoArtigo(
    artigo: Artigo
  ): void {
    this.iniciarProducaoArtigo(
      artigo
    );
  }

  abrirModalRFID(
    artigo: Artigo
  ): void {
    if (!artigo._id) return;

    this.artigoRFIDSelecionado =
      artigo;

    this.modalRFIDAberto = true;

    this.carregarStatusRFID(true);
  }

  fecharModalRFID(): void {
    this.modalRFIDAberto = false;
    this.artigoRFIDSelecionado = null;
    this.rfidEtiquetasCadastradas = 0;
    this.rfidEtiquetasRevisadas = 0;
    this.rfidQuantidade = 0;
    this.rfidScanStatus =
      'nao_aplicavel';

    this.carregarArtigos();
  }

  carregarStatusRFID(
    mostrarErro = true
  ): void {
    const id =
      this.artigoRFIDSelecionado
        ?._id;

    if (!id) return;

    this.rfidCarregando = true;

    this.artigosService
      .obterStatusRFID(id)
      .subscribe({
        next: (status) => {
          this.rfidCarregando = false;

          this.rfidEtiquetasCadastradas =
            status.etiquetasCadastradas ||
            0;

          this.rfidEtiquetasRevisadas =
            status.etiquetasRevisadas ||
            0;

          this.rfidQuantidade =
            status.quantidade || 0;

          this.rfidScanStatus =
            status.rfidScanStatus ||
            'aguardando';
        },
        error: (err) => {
          this.rfidCarregando = false;
          console.error(err);

          if (mostrarErro) {
            alert(
              err?.error?.message ||
              'Erro ao carregar dados RFID.'
            );
          }
        }
      });
  }

  iniciarEscaneamentoRFID(): void {
    const id =
      this.artigoRFIDSelecionado
        ?._id;

    if (!id) return;

    let preservar = false;

    if (
      this.rfidEtiquetasCadastradas >
      0
    ) {
      preservar =
        window.confirm(
          `Já existem ${this.rfidEtiquetasCadastradas} etiqueta(s).\n\n` +
          `OK = continuar de onde parou.\n` +
          `Cancelar = apagar as etiquetas e iniciar novamente.`
        );
    }

    this.artigosService
      .iniciarLeituraRFID(
        id,
        preservar
      )
      .subscribe({
        next: () => {
          this.carregarStatusRFID(
            false
          );

          alert(
            'Leitura RFID iniciada.\n\n' +
            'O dispositivo de cadastro de etiquetas poderá agora enviar os EPCs.'
          );
        },
        error: (err) => {
          console.error(err);

          alert(
            err?.error?.message ||
            'Erro ao iniciar leitura RFID.'
          );
        }
      });
  }

  finalizarEscaneamentoRFID(): void {
    const id =
      this.artigoRFIDSelecionado
        ?._id;

    if (!id) return;

    this.artigosService
      .finalizarLeituraRFID(id)
      .subscribe({
        next: () => {
          this.carregarStatusRFID(
            false
          );
          this.carregarArtigos();

          alert(
            'Cadastro das etiquetas RFID concluído.'
          );
        },
        error: (err) => {
          console.error(err);

          alert(
            err?.error?.message ||
            'Não foi possível concluir o cadastro RFID.'
          );

          this.carregarStatusRFID(
            false
          );
        }
      });
  }

  get percentualRFID(): number {
    if (!this.rfidQuantidade) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (
          this.rfidEtiquetasCadastradas /
          this.rfidQuantidade
        ) *
          100
      )
    );
  }

  get percentualRevisaoRFID(): number {
    if (!this.rfidQuantidade) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (
          this.rfidEtiquetasRevisadas /
          this.rfidQuantidade
        ) *
          100
      )
    );
  }

  formatarStatusRFID(
    status?: RFIDScanStatus
  ): string {
    const mapa: Record<
      RFIDScanStatus,
      string
    > = {
      nao_aplicavel: 'Não aplicável',
      aguardando:
        'Aguardando etiquetas',
      em_leitura:
        'Escaneando etiquetas',
      concluido: 'Pronto para revisão'
    };

    return mapa[
      status || 'nao_aplicavel'
    ];
  }

  abrirModalOperacao(): void {
    this.novaOperacao = {
      nome: '',
      pecasPorHora: 1,
      cortesPorPeca: 0,
      descricao: ''
    };
    this.modalOperacaoAberto = true;
  }

  fecharModalOperacao(): void {
    this.modalOperacaoAberto = false;
  }

  cadastrarOperacao(): void {
    this.operacoesService
      .cadastrarOperacao(
        this.novaOperacao
      )
      .subscribe({
        next: () => {
          this.fecharModalOperacao();
          this.carregarOperacoes();
        },
        error: (err) => {
          console.error(err);
          alert(
            'Erro ao cadastrar operação.'
          );
        }
      });
  }

  abrirModalCliente(): void {
    this.novoCliente = {
      nome: '',
      contato: ''
    };
    this.modalClienteAberto = true;
  }

  fecharModalCliente(): void {
    this.modalClienteAberto = false;
  }

  cadastrarCliente(): void {
    this.clientesService
      .cadastrarCliente(
        this.novoCliente
      )
      .subscribe({
        next: () => {
          this.fecharModalCliente();
          this.carregarClientes();
        },
        error: (err) => {
          console.error(err);
          alert(
            'Erro ao cadastrar cliente.'
          );
        }
      });
  }

  carregarXmlNota(
    event: Event
  ): void {
    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      try {
        const xml =
          String(reader.result || '');

        const doc =
          new DOMParser()
            .parseFromString(
              xml,
              'application/xml'
            );

        const codigo =
          doc.querySelector('prod > cProd')
            ?.textContent
            ?.trim();

        const nome =
          doc.querySelector('prod > xProd')
            ?.textContent
            ?.trim();

        const quantidade =
          doc.querySelector('prod > qCom')
            ?.textContent
            ?.trim();

        const valor =
          doc.querySelector('prod > vUnCom')
            ?.textContent
            ?.trim();

        const cliente =
          doc.querySelector('dest > xNome')
            ?.textContent
            ?.trim();

        if (codigo) {
          this.novoArtigo.codigo =
            codigo;
        }

        if (nome) {
          this.novoArtigo.nome =
            nome;
        }

        if (quantidade) {
          this.novoArtigo.quantidade =
            Number(quantidade);
        }

        if (valor) {
          this.novoArtigo.valor =
            Number(valor);
        }

        if (cliente) {
          this.novoArtigo.cliente =
            cliente;
        }
      } catch (err) {
        console.error(err);

        alert(
          'Erro ao processar XML.'
        );
      }
    };

    reader.readAsText(file);
  }

  private criarArtigoPadrao():
    ArtigoForm {
    return {
      codigo: '',
      nome: '',
      operacao: '',
      cliente: '',
      dataInclusao:
        new Date()
          .toISOString()
          .substring(0, 10),
      valor: null,
      quantidade: null,
      status: 'pendente',
      rfidEnabled: false
    };
  }

  voltar(): void {
    this.router.navigate(['/']);
  }
}
