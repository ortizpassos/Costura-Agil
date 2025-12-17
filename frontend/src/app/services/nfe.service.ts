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

@Injectable({
  providedIn: 'root'
})
export class NfeService {
  private apiUrl = 'http://localhost:3000/api/nfe';

  constructor(private http: HttpClient) { }

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
}