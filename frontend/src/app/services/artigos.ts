import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type RFIDScanStatus =
  | 'nao_aplicavel'
  | 'aguardando'
  | 'em_leitura'
  | 'concluido';

export interface Artigo {
  _id?: string;
  codigo: string;
  nome: string;
  operacao: string;
  cliente: string;
  dataInclusao: string;
  valor: number;
  quantidade: number;
  quantidadeAtual?: number;
  status?: string;
  criadoPor?: string | { _id: string };
  criadoEm?: string;

  rfidEnabled?: boolean;
  rfidScanStatus?: RFIDScanStatus;
  rfidTagsCount?: number;
  rfidScanStartedAt?: string | null;
  rfidScanFinishedAt?: string | null;
}

export interface RFIDStatusResponse {
  artigoId: string;
  codigo: string;
  nome: string;
  quantidade: number;
  rfidEnabled: boolean;
  rfidScanStatus: RFIDScanStatus;
  etiquetasCadastradas: number;
  etiquetasRevisadas: number;
  etiquetasPendentes: number;
}

@Injectable({ providedIn: 'root' })
export class ArtigosService {
  private apiUrl =
    window.location.hostname === 'localhost'
      ? '/api/artigos'
      : 'https://monitor-ellas-backend.onrender.com/api/artigos';

  constructor(private http: HttpClient) {}

  listarArtigos(): Observable<Artigo[]> {
    return this.http.get<Artigo[]>(this.apiUrl);
  }

  cadastrarArtigo(artigo: Partial<Artigo>): Observable<Artigo> {
    return this.http.post<Artigo>(this.apiUrl, artigo);
  }

  atualizarArtigo(
    id: string,
    artigo: Partial<Artigo>
  ): Observable<Artigo> {
    return this.http.put<Artigo>(
      `${this.apiUrl}/${id}`,
      artigo
    );
  }

  excluirArtigo(id: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/${id}`
    );
  }

  obterStatusRFID(
    artigoId: string
  ): Observable<RFIDStatusResponse> {
    return this.http.get<RFIDStatusResponse>(
      `${this.apiUrl}/${artigoId}/rfid`
    );
  }

  iniciarLeituraRFID(
    artigoId: string,
    preservar = false
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${artigoId}/rfid/start`,
      { preservar }
    );
  }

  finalizarLeituraRFID(
    artigoId: string
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${artigoId}/rfid/finish`,
      {}
    );
  }
}
