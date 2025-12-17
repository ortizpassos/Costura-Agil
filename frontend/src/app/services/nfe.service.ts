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
  private apiUrl = 'http://localhost:3001/api/nfe';

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
    const request: NfeGerarRequest = { xml };
    return this.http.post<NfeResponse>(`${this.apiUrl}/gerar`, request);
  }

  consultarNfe(chave: string): Observable<NfeResponse> {
    const request: NfeConsultarRequest = { chave };
    return this.http.post<NfeResponse>(`${this.apiUrl}/consultar`, request);
  }

  cancelarNfe(chave: string, justificativa: string): Observable<NfeResponse> {
    const request: NfeCancelarRequest = { chave, justificativa };
    return this.http.post<NfeResponse>(`${this.apiUrl}/cancelar`, request);
  }

  enviarCce(chave: string, correcao: string): Observable<NfeResponse> {
    const request: NfeCceRequest = { chave, correcao };
    return this.http.post<NfeResponse>(`${this.apiUrl}/cce`, request);
  }

  // Método para estatísticas do dashboard
  getEstatisticas(): Observable<NfeEstatisticas> {
    return this.http.get<NfeEstatisticas>(`${this.apiUrl}/estatisticas`);
  }
}