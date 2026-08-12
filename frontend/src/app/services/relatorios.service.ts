import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RelatoriosService {
  private apiUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api/relatorios'
    : 'https://monitor-ellas-backend.onrender.com/api/relatorios';

  constructor(private http: HttpClient) {}

  buscarRelatorios(filtros: {
    dataInicio?: string;
    dataFim?: string;
    funcionario?: string;
    artigo?: string;
  }): Observable<any[]> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    let params = new HttpParams();
    if (filtros.dataInicio) params = params.set('dataInicio', filtros.dataInicio);
    if (filtros.dataFim) params = params.set('dataFim', filtros.dataFim);
    if (filtros.funcionario) params = params.set('funcionario', filtros.funcionario);
    if (filtros.artigo) params = params.set('artigo', filtros.artigo);
    return this.http.get<any[]>(this.apiUrl, { headers, params });
  }
  
  buscarEstatisticas(filtros: {
    dataInicio?: string;
    dataFim?: string;
  }): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    let params = new HttpParams();
    if (filtros.dataInicio) params = params.set('dataInicio', filtros.dataInicio);
    if (filtros.dataFim) params = params.set('dataFim', filtros.dataFim);
    return this.http.get<any>(`${this.apiUrl}/estatisticas`, { headers, params });
  }
}
