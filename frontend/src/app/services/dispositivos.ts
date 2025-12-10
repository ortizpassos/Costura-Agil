import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Dispositivo {
  _id?: string;
  usuario?: string | { _id: string };
  deviceToken: string;
  nome: string;
  metaDiaria: number;
  operacao: string;
  artigo?: {
    _id?: string;
    nome?: string;
    codigo?: string;
    cliente?: string;
    quantidade?: number;
    quantidadeAtual?: number;
  };
  setor: string;
  status?: string;
  producaoAtual?: number;
  funcionarioLogado?: { nome: string };
  ultimaAtualizacao?: string | Date;
}

@Injectable({
  providedIn: 'root'
})
export class DispositivosService {
  private apiUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001/api/dispositivos'
    : 'https://monitor-ellas-backend.onrender.com/api/dispositivos';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  listarDispositivos(): Observable<Dispositivo[]> {
    return this.http.get<Dispositivo[]>(this.apiUrl, { headers: this.getAuthHeaders() });
  }

  cadastrarDispositivo(dispositivo: Dispositivo): Observable<any> {
    return this.http.post(this.apiUrl, dispositivo, { headers: this.getAuthHeaders() });
  }

  editarDispositivo(id: string, dispositivo: Dispositivo): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}`, dispositivo, { headers: this.getAuthHeaders() });
  }

  excluirDispositivo(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }
}
