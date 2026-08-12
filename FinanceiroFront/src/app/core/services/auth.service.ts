import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly SESSION_KEY = 'authSession_v1';
  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private api: ApiService, private router: Router) {}

  private getUserFromStorage() {
    const session = localStorage.getItem(this.SESSION_KEY);
    return session ? JSON.parse(session).user : null;
  }

  getToken(): string | null {
    const session = localStorage.getItem(this.SESSION_KEY);
    return session ? JSON.parse(session).token : null;
  }

  login(credentials: any): Observable<any> {
    return this.api.post('/auth/login', credentials).pipe(
      tap((data: any) => {
        this.setSession(data.token, data.user);
      })
    );
  }

  register(data: any): Observable<any> {
    return this.api.post('/auth/register', data);
  }

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/']);
  }

  private setSession(token: string, user: any) {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify({ token, user, ts: Date.now() }));
    this.currentUserSubject.next(user);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
