import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Nfe {
  id?: number;
  numero: string;
  dataEmissao: string;
  cliente: string;
  valorTotal: number;
  status: string;
}

export interface NfeGerarRequest {
  xml: string;
}

export interface NfeConsultarRequest {
  chave: string;
}

export interface NfeCancelarRequest {
  chave: string;
  justificativa: string;
}

export interface NfeCceRequest {
  chave: string;
  correcao: string;
}

export interface NfeRecebida {
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  emitente: string;
  valorTotal: number;
  status: string;
}

export interface NfeResponse {
  message?: string;
  result?: string;
  error?: string;
}

export interface NfeEstatisticas {
  emitidas: number;
  recebidas: number;
  canceladas: number;
  totalMensal: number;
}

@Injectable({
  providedIn: 'root'
})
export class NfeService {
  private apiUrl = 'http://localhost:8082/api/nfe';

  constructor(private http: HttpClient) { }

  // Métodos CRUD básicos
  getNfe(): Observable<Nfe[]> {
    return this.http.get<Nfe[]>(this.apiUrl);
  }

  createNfe(nfe: Omit<Nfe, 'id'>): Observable<Nfe> {
    return this.http.post<Nfe>(this.apiUrl, nfe);
  }

  updateNfe(id: number, nfe: Partial<Nfe>): Observable<Nfe> {
    return this.http.put<Nfe>(`${this.apiUrl}/${id}`, nfe);
  }

  deleteNfe(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Métodos específicos de NFe
  getStatus(): Observable<NfeResponse> {
    return this.http.get<NfeResponse>(`${this.apiUrl}/status`);
  }

  gerarNfe(xml: string): Observable<NfeResponse> {
    return this.http.post<NfeResponse>(`${this.apiUrl}/gerar`, xml, {
      headers: { 'Content-Type': 'application/xml' }
    });
  }

  consultarNfe(chave: string): Observable<NfeResponse> {
    return this.http.post<NfeResponse>(`${this.apiUrl}/consultar`, null, {
      params: { chave }
    });
  }

  cancelarNfe(chave: string, justificativa: string): Observable<NfeResponse> {
    return this.http.post<NfeResponse>(`${this.apiUrl}/cancelar`, null, {
      params: { chave, justificativa }
    });
  }

  enviarCce(chave: string, correcao: string): Observable<NfeResponse> {
    return this.http.post<NfeResponse>(`${this.apiUrl}/cce`, null, {
      params: { chave, correcao }
    });
  }

  // Método para consultar notas recebidas
  consultarNotasRecebidas(cnpj: string, dataInicio?: string, dataFim?: string): Observable<NfeRecebida[]> {
    let params: any = { cnpj };
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    return this.http.get<NfeRecebida[]>(`${this.apiUrl}/recebidas`, { params });
  }

  // Método para estatísticas do dashboard
  getEstatisticas(): Observable<NfeEstatisticas> {
    return this.http.get<NfeEstatisticas>(`${this.apiUrl}/estatisticas`);
  }
}