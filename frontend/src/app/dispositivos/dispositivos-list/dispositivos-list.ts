import {
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  Router
} from '@angular/router';

import {
  Subscription,
  interval
} from 'rxjs';

import {
  DispositivosService,
  Dispositivo,
  HardwareLookup,
  ActivationCreateResponse
} from '../../services/dispositivos';

import {
  SidebarComponent
} from '../../shared/sidebar/sidebar';

import {
  SocketService
} from '../../services/socket.service';

import {
  AuthService
} from '../../services/auth.service';

@Component({
  selector:
    'app-dispositivos-list',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent
  ],

  templateUrl:
    './dispositivos-list.html',

  styleUrl:
    './dispositivos-list.css'
})
export class DispositivosList
  implements OnInit, OnDestroy {

  dispositivos:
    Dispositivo[] = [];

  // Modal legado: cadastro manual por token.
  modalAberto = false;

  dispositivoEditando:
    Dispositivo | null = null;

  erroCadastro = '';

  form: any = {
    nome: '',
    deviceToken: ''
  };

  // --------------------------------------------------------
  // ATIVAÇÃO NOVA VIA DEVICE ID + PIX
  // --------------------------------------------------------
  modalAtivacao = false;

  activationStep:
    'device' |
    'payment' |
    'success' =
    'device';

  activationDeviceId = '';
  activationNome = '';

  activationHardware:
    HardwareLookup | null =
    null;

  activationLoading = false;
  activationError = '';

  activationAmount = 0;
  activationCurrency = 'BRL';

  activationId = '';
  activationPaymentId = '';
  activationQrCode = '';
  activationQrCodeBase64 = '';

  activationToken = '';
  activationHardwareLinked = false;

  private activationPoll?:
    Subscription;

  // --------------------------------------------------------
  // SUBSTITUIÇÃO DE HARDWARE
  // --------------------------------------------------------
  modalSubstituir = false;

  replaceToken = '';
  replaceDeviceId = '';

  replaceLoading = false;
  replaceError = '';
  replaceSuccess = '';

  private subscriptions:
    Subscription[] = [];

  constructor(
    private dispositivosService:
      DispositivosService,

    private socketService:
      SocketService,

    private authService:
      AuthService,

    private router:
      Router
  ) {}

  ngOnInit(): void {
    if (
      !this.authService
        .isAuthenticated()
    ) {
      this.router.navigate(
        ['/login']
      );

      return;
    }

    this.carregarDispositivos();

    const socketSub =
      this.socketService
        .onDeviceStatusUpdate()
        .subscribe(
          (updated: any) => {
            if (
              !updated ||
              !updated._id
            ) {
              return;
            }

            const idx =
              this.dispositivos
                .findIndex(
                  d =>
                    d._id ===
                    updated._id
                );

            if (idx !== -1) {
              this.dispositivos[idx] = {
                ...this.dispositivos[idx],
                ...updated
              };
            }
          }
        );

    this.subscriptions.push(
      socketSub
    );
  }

  ngOnDestroy(): void {
    this.stopActivationPoll();

    this.subscriptions.forEach(
      sub =>
        sub.unsubscribe()
    );
  }

  carregarDispositivos(): void {
    this.dispositivosService
      .listarDispositivos()
      .subscribe({
        next: data => {
          this.dispositivos =
            data || [];
        },

        error: err => {
          console.error(
            'Erro ao carregar dispositivos:',
            err
          );
        }
      });
  }

  // ========================================================
  // CADASTRO MANUAL LEGADO
  // ========================================================
  abrirCadastro(): void {
    this.modalAberto = true;
    this.dispositivoEditando =
      null;

    this.form = {
      nome: '',
      deviceToken: ''
    };
  }

  abrirEdicao(
    dispositivo: Dispositivo
  ): void {
    this.modalAberto = true;

    this.dispositivoEditando =
      dispositivo;

    this.form = {
      ...dispositivo
    };
  }

  fecharModal(): void {
    this.modalAberto = false;

    this.dispositivoEditando =
      null;

    this.erroCadastro = '';
  }

  salvarDispositivo(): void {
    this.erroCadastro = '';

    if (
      this.dispositivoEditando
    ) {
      this.dispositivosService
        .editarDispositivo(
          this.dispositivoEditando
            ._id!,
          this.form
        )
        .subscribe({
          next: data => {
            const idx =
              this.dispositivos
                .findIndex(
                  d =>
                    d._id ===
                    data._id
                );

            if (idx !== -1) {
              this.dispositivos[idx] =
                data;
            }

            this.fecharModal();
          },

          error: err => {
            this.erroCadastro =
              err?.error?.message ||
              'Erro ao editar dispositivo.';
          }
        });

      return;
    }

    this.dispositivosService
      .cadastrarDispositivo(
        this.form
      )
      .subscribe({
        next: data => {
          this.dispositivos.push(
            data
          );

          this.fecharModal();
        },

        error: err => {
          this.erroCadastro =
            err?.error?.message ||
            'Erro ao cadastrar dispositivo.';
        }
      });
  }

  excluirDispositivo(
    dispositivo: Dispositivo
  ): void {
    if (
      !confirm(
        'Deseja realmente excluir este dispositivo?'
      )
    ) {
      return;
    }

    this.dispositivosService
      .excluirDispositivo(
        dispositivo._id!
      )
      .subscribe({
        next: () => {
          this.dispositivos =
            this.dispositivos.filter(
              d =>
                d._id !==
                dispositivo._id
            );
        }
      });
  }

  // ========================================================
  // ATIVAR NOVA LICENÇA
  // ========================================================
  abrirAtivacao(): void {
    this.stopActivationPoll();

    this.modalAtivacao = true;
    this.activationStep =
      'device';

    this.activationDeviceId = '';
    this.activationNome = '';

    this.activationHardware =
      null;

    this.activationLoading =
      false;

    this.activationError = '';

    this.activationId = '';
    this.activationPaymentId = '';

    this.activationQrCode = '';
    this.activationQrCodeBase64 =
      '';

    this.activationToken = '';

    this.activationHardwareLinked =
      false;

    this.dispositivosService
      .obterConfigAtivacao()
      .subscribe({
        next: config => {
          this.activationAmount =
            config.amount;

          this.activationCurrency =
            config.currency;
        }
      });
  }

  fecharAtivacao(): void {
    this.stopActivationPoll();

    this.modalAtivacao = false;
  }

  buscarHardwareAtivacao():
    void {
    const deviceId =
      this.activationDeviceId
        .trim()
        .toUpperCase();

    if (!deviceId) {
      this.activationError =
        'Informe o Device ID.';

      return;
    }

    this.activationError = '';
    this.activationLoading =
      true;

    this.dispositivosService
      .buscarHardware(deviceId)
      .subscribe({
        next: hardware => {
          this.activationLoading =
            false;

          this.activationHardware =
            hardware;

          this.activationDeviceId =
            hardware.hardware
              .deviceId;

          if (
            hardware.hardware
              .linked
          ) {
            this.activationError =
              'Este hardware já está vinculado a uma licença.';
          }
        },

        error: err => {
          this.activationLoading =
            false;

          this.activationHardware =
            null;

          this.activationError =
            err?.error?.message ||
            'Device ID não encontrado.';
        }
      });
  }

  gerarPixAtivacao(): void {
    if (
      !this.activationHardware ||
      this.activationHardware
        .hardware.linked
    ) {
      return;
    }

    this.activationLoading =
      true;

    this.activationError = '';

    this.dispositivosService
      .criarAtivacao(
        this.activationDeviceId,
        this.activationNome
      )
      .subscribe({
        next:
          (
            data:
              ActivationCreateResponse
          ) => {
            this.activationLoading =
              false;

            this.activationId =
              data.activationId;

            this.activationPaymentId =
              data.paymentId;

            this.activationQrCode =
              data.qrCode;

            this.activationQrCodeBase64 =
              data.qrCodeBase64 ||
              '';

            this.activationAmount =
              data.amount;

            this.activationCurrency =
              data.currency;

            this.activationStep =
              'payment';

            this.startActivationPoll();
          },

        error: err => {
          this.activationLoading =
            false;

          this.activationError =
            err?.error?.message ||
            'Não foi possível gerar o PIX.';
        }
      });
  }

  copiarPix(): void {
    if (
      !this.activationQrCode
    ) {
      return;
    }

    navigator.clipboard
      ?.writeText(
        this.activationQrCode
      )
      .catch(() => {});
  }

  private startActivationPoll():
    void {
    this.stopActivationPoll();

    this.activationPoll =
      interval(2500)
        .subscribe(() => {
          if (
            !this.activationId
          ) {
            return;
          }

          this.dispositivosService
            .consultarAtivacao(
              this.activationId
            )
            .subscribe({
              next: status => {
                if (
                  status.status !==
                  'approved'
                ) {
                  return;
                }

                this.activationToken =
                  status.deviceToken ||
                  '';

                this.activationHardwareLinked =
                  status.hardwareLinked ===
                  true;

                this.activationStep =
                  'success';

                this.stopActivationPoll();

                this.carregarDispositivos();
              },

              error: err => {
                console.error(
                  'Erro ao consultar PIX:',
                  err
                );
              }
            });
        });
  }

  private stopActivationPoll():
    void {
    this.activationPoll
      ?.unsubscribe();

    this.activationPoll =
      undefined;
  }

  // ========================================================
  // SUBSTITUIR HARDWARE
  // ========================================================
  abrirSubstituir(
    dispositivo?:
      Dispositivo
  ): void {
    this.modalSubstituir =
      true;

    this.replaceToken =
      dispositivo
        ?.deviceToken ||
      '';

    this.replaceDeviceId =
      '';

    this.replaceLoading =
      false;

    this.replaceError =
      '';

    this.replaceSuccess =
      '';
  }

  fecharSubstituir(): void {
    this.modalSubstituir =
      false;

    this.replaceError =
      '';

    this.replaceSuccess =
      '';
  }

  substituirHardware(): void {
    const token =
      this.replaceToken.trim();

    const deviceId =
      this.replaceDeviceId
        .trim()
        .toUpperCase();

    if (
      !token ||
      !deviceId
    ) {
      this.replaceError =
        'Selecione a licença e informe o novo Device ID.';

      return;
    }

    this.replaceLoading =
      true;

    this.replaceError =
      '';

    this.replaceSuccess =
      '';

    this.dispositivosService
      .vincularHardware(
        token,
        deviceId
      )
      .subscribe({
        next: data => {
          this.replaceLoading =
            false;

          this.replaceSuccess =
            data.alreadyLinked
              ? 'Este hardware já estava vinculado à licença.'
              : 'Novo hardware vinculado com sucesso. Não houve nova cobrança.';

          this.carregarDispositivos();
        },

        error: err => {
          this.replaceLoading =
            false;

          this.replaceError =
            err?.error?.message ||
            'Não foi possível substituir o hardware.';
        }
      });
  }

  // ========================================================
  // HELPERS
  // ========================================================
  tipoDispositivo(
    dispositivo:
      Dispositivo
  ): string {
    const type =
      dispositivo.deviceType ||
      'producao';

    const labels:
      Record<string, string> = {
        producao:
          'Produção',

        revisao_rfid:
          'Revisão RFID',

        cadastro_rfid:
          'Cadastro RFID'
      };

    return (
      labels[type] ||
      type
    );
  }

  tipoHardware(
    type?: string
  ): string {
    const labels:
      Record<string, string> = {
        producao:
          'Produção',

        revisao_rfid:
          'Revisão RFID',

        cadastro_rfid:
          'Leitor de Cadastro RFID'
      };

    return (
      labels[type || ''] ||
      type ||
      '-'
    );
  }

  tokenMascarado(
    token: string
  ): string {
    if (!token) {
      return '-';
    }

    if (token.length <= 6) {
      return token;
    }

    return (
      token.slice(0, 4) +
      '•••••••' +
      token.slice(-4)
    );
  }
}
