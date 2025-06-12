import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
import { AuthResponse, LoginRequest, RegisterRequest, User, BackendUserResponse } from '../dto/user.dto'; 
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly AUTH_API_URL = 'http://127.0.0.1:8080/api/v1';
  private readonly USER_API_URL = 'http://127.0.0.1:8080/api/v1/me';

  private tokenExpirationTimer: any;
  private isBrowser: boolean;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  public initializeAuth(): Observable<any> {
    if (!this.isBrowser) {
      return of(null); 
    }

    const token = this.getToken();
    const expirationTime = localStorage.getItem('tokenExpiration');

    if (token && expirationTime) {
      const expiresIn = new Date(expirationTime).getTime() - new Date().getTime();
      if (expiresIn > 0) {
        this.autoLogout(expiresIn); 
        return this.fetchAndSetCurrentUser().pipe(
          catchError(() => {
            return of(null);
          })
        );
      }
    }

    this.logout(); 
    return of(null);
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  fetchAndSetCurrentUser(): Observable<User> {
    if (!this.getToken()) {
      return throwError(() => new Error('Authentication token not found.'));
    }

    return this.http.get<BackendUserResponse>(this.USER_API_URL, { headers: this.getAuthHeaders() })
      .pipe(
        map(backendUser => {
          const user: User = {
            id: backendUser.userId,
            email: backendUser.email,
            fullName: backendUser.fullName
          };
          return user;
        }),
        tap(user => {
          this.currentUserSubject.next(user);
          this.isAuthenticatedSubject.next(true);
        }),
        catchError(error => {
          console.error('Failed to fetch current user', error);
          this.logout();
          return throwError(() => new Error('Could not fetch user profile. Session terminated.'));
        })
      );
  }

  private checkForStoredAuth(): void {
    if (!this.isBrowser) {
      return;
    }

    const token = this.getToken();
    const expirationTime = localStorage.getItem('tokenExpiration');

    if (token && expirationTime) {
      const expiresIn = new Date(expirationTime).getTime() - new Date().getTime();
      if (expiresIn > 0) {
        this.autoLogout(expiresIn);
        this.fetchAndSetCurrentUser().subscribe({
          next: () => console.log('Session restored successfully.'),
          error: (err) => console.error('Failed to restore session with stored token.', err)
        });
      } else {
        this.logout();
      }
    }
  }

  login(loginData: LoginRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${this.AUTH_API_URL}/login`, loginData)
      .pipe(
        switchMap(response => {
          this.handleToken(response); 
          return this.fetchAndSetCurrentUser(); 
        }),
        catchError(error => {
          console.error('Login error:', error);
          return throwError(() => new Error(error.error?.message || 'Login failed. Please check your credentials.'));
        })
      );
  }

  register(registerData: RegisterRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${this.AUTH_API_URL}/register`, registerData)
      .pipe(
        switchMap(response => {
          this.handleToken(response); 
          return this.fetchAndSetCurrentUser(); 
        }),
        catchError(error => {
          console.error('Registration error:', error);
          return throwError(() => new Error(error.error?.message || 'Registration failed. Please try again.'));
        })
      );
  }

  private handleToken(authResponse: AuthResponse): void {
    if (!authResponse.token) {
        throw new Error("Authentication response did not include a token.");
    }
    const expiresIn = authResponse.expiresIn || 86400; 

    if (this.isBrowser) {
      localStorage.setItem('token', authResponse.token);
      const expirationDate = new Date(new Date().getTime() + expiresIn * 1000);
      localStorage.setItem('tokenExpiration', expirationDate.toISOString());
      this.autoLogout(expiresIn * 1000);
    }
  }

  logout(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);

    if (this.isBrowser) {
      localStorage.removeItem('token');
      localStorage.removeItem('userData'); 
      localStorage.removeItem('tokenExpiration');
    }

    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
    this.router.navigate(['/login']);
  }


  private autoLogout(expirationDuration: number): void {
     if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    this.tokenExpirationTimer = setTimeout(() => {
      this.logout();
    }, expirationDuration);
  }

  getToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getCurrentUserId(): string | null {
    const currentUser = this.currentUserSubject.value;
    return currentUser ? currentUser.id : null;
  }

  checkAuthAndRedirect(): void {
    if (this.isAuthenticated()) {
      this.router.navigate(['/main-page']);
    }
  }
}