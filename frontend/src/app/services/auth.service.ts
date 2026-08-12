import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User, UserRegistration, UserLogin, AuthResponse } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001/api/auth'
    : 'https://monitor-ellas-backend.onrender.com/api/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadStoredAuth();
  }

  register(userData: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/cadastro`, userData)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.setAuth(response.data.user, response.data.token);
          }
        })
      );
  }

  login(credentials: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.setAuth(response.data.user, response.data.token);
          }
        })
      );
  }

  logout(): void {
    this.clearAuth();
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp > currentTime;
    } catch {
      return false;
    }
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getCurrentUserId(): string | null {
    return this.currentUserSubject.value?.id ?? null;
  }

  private setAuth(user: User, token: string) {
    this.currentUserSubject.next(user);
    this.tokenSubject.next(token);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  private clearAuth() {
    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  private loadStoredAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      this.tokenSubject.next(token);
      this.currentUserSubject.next(JSON.parse(user));
    }
  }
}
