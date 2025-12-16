import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl: string;

  constructor(private http: HttpClient) {
    this.apiUrl = this.resolveBase();
  }

  private resolveBase(): string {
    // URL do backend hospedado no Render
    return 'https://sistema-financeiro-completo-backend.onrender.com/api';

    // Para desenvolvimento local (descomente se necessário):
    // const { protocol, hostname } = window.location;
    // const backendPort = 3000;
    // return `${protocol}//${hostname}:${backendPort}/api`;
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('authSession_v1') 
      ? JSON.parse(localStorage.getItem('authSession_v1')!).token 
      : null;
      
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}${path}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}${path}`, body, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}${path}`, body, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}${path}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any) {
    console.error('API Error:', error);
    return throwError(() => new Error(error.error?.error || error.message || 'Server Error'));
  }

  // Sales methods
  getSales(): Observable<any[]> {
    return this.get('/sales');
  }

  getSalesChannels(): Observable<any[]> {
    return this.get('/sales-channels');
  }

  createSale(sale: any): Observable<any> {
    return this.post('/sales', sale);
  }

  updateSale(id: string, sale: any): Observable<any> {
    return this.put(`/sales/${id}`, sale);
  }

  // Expenses methods
  getExpenses(): Observable<any[]> {
    return this.get('/expenses');
  }

  createExpense(expense: any): Observable<any> {
    return this.post('/expenses', expense);
  }

  updateExpense(id: string, expense: any): Observable<any> {
    return this.put(`/expenses/${id}`, expense);
  }

  deleteExpense(id: string): Observable<any> {
    return this.delete(`/expenses/${id}`);
  }

  // Categories methods
  getCategories(): Observable<any[]> {
    return this.get('/categories');
  }

  // Suppliers methods
  getSuppliers(): Observable<any[]> {
    return this.get('/suppliers');
  }

  // Payment Methods methods
  getPaymentMethods(): Observable<any[]> {
    return this.get('/payment-methods');
  }

  // Receipts methods
  getReceipts(): Observable<any[]> {
    return this.get('/receipts');
  }

  createReceipt(receipt: any): Observable<any> {
    return this.post('/receipts', receipt);
  }

  updateReceipt(id: string, receipt: any): Observable<any> {
    return this.put(`/receipts/${id}`, receipt);
  }

  deleteReceipt(id: string): Observable<any> {
    return this.delete(`/receipts/${id}`);
  }

  // Receipt Methods methods
  getReceiptMethods(): Observable<any[]> {
    return this.get('/receipt-methods');
  }
}
