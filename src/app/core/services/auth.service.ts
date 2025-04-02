import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '../dto/user.dto';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://127.0.0.1:8080/api/v1'; // Replace with your actual API URL
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
    this.checkForStoredAuth();
  }

  private checkForStoredAuth(): void {
    if (!this.isBrowser) {
      return; // Skip localStorage operations when not in browser
    }
    
    const userData = localStorage.getItem('userData');
    const token = localStorage.getItem('token');
    
    if (userData && token) {
      const user: User = JSON.parse(userData);
      this.currentUserSubject.next(user);
      this.isAuthenticatedSubject.next(true);
      
      const expirationTime = localStorage.getItem('tokenExpiration');
      if (expirationTime) {
        const expiresIn = new Date(expirationTime).getTime() - new Date().getTime();
        if (expiresIn > 0) {
          this.autoLogout(expiresIn);
        } else {
          this.logout();
        }
      }
    }
  }

  register(registerData: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, registerData)
      .pipe(
        tap(response => {
          if (response.token) {
            this.handleAuthentication(response);
          }
        }),
        catchError(error => {
          console.error('Registration error:', error);
          return throwError(() => new Error(error.error?.message || 'Registration failed. Please try again.'));
        })
      );
  }

  checkAuthAndRedirect(): void {
    if (this.isAuthenticated()) {
      this.router.navigate(['/main-page']);
    }
  }

  login(loginData: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, loginData)
      .pipe(
        tap(response => {
          this.handleAuthentication(response);
        }),
        catchError(error => {
          console.error('Login error:', error);
          return throwError(() => new Error(error.error?.message || 'Login failed. Please check your credentials.'));
        })
      );
  }

  private handleAuthentication(authResponse: AuthResponse): void {
    const expiresIn = authResponse.expiresIn || 86400; 
    const user: User = {
      id: authResponse.userId,
      email: authResponse.email,
      fullName: authResponse.fullName
    };
    console.log('User:', user);

    // Update state
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
    console.log('User:2', user);
    
    // Store auth data in localStorage only in browser environment
    if (this.isBrowser) {
      localStorage.setItem('token', authResponse.token);
      localStorage.setItem('userData', JSON.stringify(user));
      
      // Set token expiration
      const expirationDate = new Date(new Date().getTime() + expiresIn * 1000);
      localStorage.setItem('tokenExpiration', expirationDate.toISOString());
      
      // Set auto logout
      this.autoLogout(expiresIn * 1000);
    }
  }

  // Get JWT token
  getToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return localStorage.getItem('token');
  }

  // Auto logout when token expires
  private autoLogout(expirationDuration: number): void {
    this.tokenExpirationTimer = setTimeout(() => {
      this.logout();
    }, expirationDuration);
  }

  // Logout user
  logout(): void {
    // Clear state
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    
    // Clear localStorage only in browser environment
    if (this.isBrowser) {
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
      localStorage.removeItem('tokenExpiration');
    }
    
    // Clear timeout
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
  }

  // Check if current user is authenticated
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  // Get current user data
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
}