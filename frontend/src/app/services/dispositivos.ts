import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export type DeviceType =
  | 'producao'
  | 'revisao_rfid'
  | 'cadastro_rfid';

export interface Dispositivo {
  _id?: string;
  usuario?: string | { _id: string };

  deviceToken: string;
  nome: string;

  metaDiaria?: number;
  operacao?: any;

  deviceType?: DeviceType;

  hardwareDeviceId?: string;
  hardwareLinkedAt?: string | Date;

  activated?: boolean;
  activationPaid?: boolean;

  artigo?: {
    _id?: string;
    nome?: string;
    codigo?: string;
    cliente?: string;
    quantidade?: number;
    quantidadeAtual?: number;
  };

  status?: string;
  producaoAtual?: number;

  funcionarioLogado?: {
    nome: string
  };

  ultimaAtualizacao?:
    string | Date;
}

export interface HardwareLookup {
  found: boolean;

  hardware: {
    deviceId: string;
    deviceType: DeviceType;
    status: string;
    firmwareVersion?: string;
    lastSeenAt?: string;
    linked: boolean;
  };

  linkedLicense?: {
    nome: string;
    deviceType: DeviceType;
    belongsToCurrentUser: boolean;
  } | null;
}

export interface ActivationCreateResponse {
  activationId: string;
  paymentId: string;
  status: string;
  amount: number;
  currency: string;
  qrCode: string;
  qrCodeBase64?: string;
}

export interface ActivationStatusResponse {
  status: string;
  deviceToken?: string;
  hardwareLinked?: boolean;
  amount: number;
  currency: string;
}

@Injectable({
  providedIn: 'root'
})
export class DispositivosService {
  private backendBase =
    (
      window.location.hostname ===
        'localhost' ||
      window.location.hostname ===
        '127.0.0.1'
    )
      ? 'http://localhost:3001'
      : 'https://monitor-ellas-backend.onrender.com';

  private apiUrl =
    `${this.backendBase}/api/dispositivos`;

  private provisioningUrl =
    `${this.backendBase}/api/device-provisioning`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders():
    HttpHeaders {
    const token =
      this.authService.getToken();

    return new HttpHeaders({
      Authorization:
        token
          ? `Bearer ${token}`
          : ''
    });
  }

  listarDispositivos():
    Observable<Dispositivo[]> {
    return this.http.get<
      Dispositivo[]
    >(
      this.apiUrl,
      {
        headers:
          this.getAuthHeaders()
      }
    );
  }

  cadastrarDispositivo(
    dispositivo: Dispositivo
  ): Observable<any> {
    return this.http.post(
      this.apiUrl,
      dispositivo,
      {
        headers:
          this.getAuthHeaders()
      }
    );
  }

  editarDispositivo(
    id: string,
    dispositivo:
      Partial<Dispositivo>
  ): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/${id}`,
      dispositivo,
      {
        headers:
          this.getAuthHeaders()
      }
    );
  }

  excluirDispositivo(
    id: string
  ): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/${id}`,
      {
        headers:
          this.getAuthHeaders()
      }
    );
  }

  buscarHardware(
    deviceId: string
  ): Observable<HardwareLookup> {
    return this.http.get<
      HardwareLookup
    >(
      `${this.provisioningUrl}/hardware/${encodeURIComponent(deviceId)}`,
      {
        headers:
          this.getAuthHeaders()
      }
    );
  }

  obterConfigAtivacao():
    Observable<{
      amount: number;
      currency: string;
    }> {
    return this.http.get<{
      amount: number;
      currency: string;
    }>(
      `${this.provisioningUrl}/activation/config`,
      {
        headers:
          this.getAuthHeaders()
      }
    );
  }

  criarAtivacao(
    deviceId: string,
    nome = ''
  ): Observable<
    ActivationCreateResponse
  > {
    return this.http.post<
      ActivationCreateResponse
    >(
      `${this.provisioningUrl}/activation/create`,
      {
        deviceId,
        nome
      },
      {
        headers:
          this.getAuthHeaders()
      }
    );
  }

  consultarAtivacao(
    activationId: string
  ): Observable<
    ActivationStatusResponse
  > {
    return this.http.get<
      ActivationStatusResponse
    >(
      `${this.provisioningUrl}/activation/status`,
      {
        params: {
          activationId
        },
        headers:
          this.getAuthHeaders()
      }
    );
  }

  vincularHardware(
    deviceToken: string,
    deviceId: string
  ): Observable<any> {
    return this.http.post(
      `${this.provisioningUrl}/licenses/${encodeURIComponent(deviceToken)}/link-hardware`,
      {
        deviceId
      },
      {
        headers:
          this.getAuthHeaders()
      }
    );
  }
}
