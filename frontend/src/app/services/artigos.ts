import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  criadoPor?: string;
  criadoEm?: string;
}

@Injectable({ providedIn: 'root' })
export class ArtigosService {
  private apiUrl = window.location.hostname === 'localhost'
    ? '/api/artigos'
    : 'https://monitor-ellas-backend.onrender.com/api/artigos';

  constructor(private http: HttpClient) {}

  listarArtigos(): Observable<Artigo[]> {
    return this.http.get<Artigo[]>(this.apiUrl);
  }

  cadastrarArtigo(artigo: Partial<Artigo>): Observable<Artigo> {
    return this.http.post<Artigo>(this.apiUrl, artigo);
  }

  atualizarArtigo(id: string, artigo: Partial<Artigo>): Observable<Artigo> {
    return this.http.put<Artigo>(`${this.apiUrl}/${id}`, artigo);
  }

  excluirArtigo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
