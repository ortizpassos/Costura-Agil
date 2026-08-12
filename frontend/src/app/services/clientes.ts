import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Cliente {
  _id?: string;
  nome: string;
  contato?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private apiUrl = window.location.hostname === 'localhost'
    ? '/api/clientes'
    : 'https://monitor-ellas-backend.onrender.com/api/clientes';

  constructor(private http: HttpClient) {}

  listarClientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(this.apiUrl);
  }

  cadastrarCliente(cliente: Partial<Cliente>): Observable<Cliente> {
    return this.http.post<Cliente>(this.apiUrl, cliente);
  }
}
