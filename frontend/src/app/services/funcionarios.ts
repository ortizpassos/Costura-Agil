
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Funcionario {
  _id?: string;
  nome: string;
  codigo: string;
  funcao: string;
  ativo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FuncionariosService {
  private apiUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api/funcionarios'
    : 'https://monitor-ellas-backend.onrender.com/api/funcionarios';

  constructor(private http: HttpClient) {}

  listarFuncionarios(): Observable<Funcionario[]> {
    return this.http.get<Funcionario[]>(this.apiUrl);
  }

  cadastrarFuncionario(funcionario: Funcionario): Observable<any> {
    return this.http.post(this.apiUrl, funcionario);
  }

  editarFuncionario(id: string, funcionario: Funcionario): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}`, funcionario);
  }

  excluirFuncionario(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
