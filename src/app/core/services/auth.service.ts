import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
import { AuthResponse, LoginRequest, RegisterRequest, User, BackendUserResponse } from '../dto/user.dto'; // BackendUserResponse'ı DTO dosyasına ekleyin
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // YENİ: API URL'sini /auth ve /me için ayırdık
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
    // DEĞİŞİKLİK: Constructor içindeki `checkForStoredAuth()` çağrısını SİLİYORUZ.
    // Bu mantığı APP_INITIALIZER yönetecek.
  }

  // YENİ METOT: Uygulama başlangıcında çalışacak olan metot.
  public initializeAuth(): Observable<any> {
    if (!this.isBrowser) {
      return of(null); // Sunucu tarafı render için hemen tamamla
    }

    const token = this.getToken();
    const expirationTime = localStorage.getItem('tokenExpiration');

    if (token && expirationTime) {
      const expiresIn = new Date(expirationTime).getTime() - new Date().getTime();
      if (expiresIn > 0) {
        // Token var ve geçerli. Kullanıcıyı almayı dene.
        this.autoLogout(expiresIn); // Zamanlayıcıyı kur
        return this.fetchAndSetCurrentUser().pipe(
          catchError(() => {
            // Eğer kullanıcıyı alırken hata olursa (örn. token sunucuda geçersiz),
            // uygulamayı kitleme, devam etmesine izin ver. logout() zaten fetch içinde çağrılıyor.
            return of(null);
          })
        );
      }
    }

    // Token yoksa veya süresi dolmuşsa, hiçbir şey yapma, uygulama başlasın.
    this.logout(); // Her ihtimale karşı temizlik yap
    return of(null);
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // --- YENİ & GÜNCELLENMİŞ METOTLAR ---

  /**
   * YENİ: /me endpoint'inden kullanıcı verisini çeker ve state'i günceller.
   * Bu metot artık kullanıcı verisi için tek doğruluk kaynağıdır.
   */
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

  /**
   * GÜNCELLENDİ: Sadece token'ı kontrol eder. userData'yı localStorage'dan okumaz.
   */
  private checkForStoredAuth(): void {
    if (!this.isBrowser) {
      return;
    }

    const token = this.getToken();
    const expirationTime = localStorage.getItem('tokenExpiration');

    if (token && expirationTime) {
      const expiresIn = new Date(expirationTime).getTime() - new Date().getTime();
      if (expiresIn > 0) {
        // Token var ve süresi dolmamış. Token'ı sunucuda doğrulayıp kullanıcıyı alalım.
        this.autoLogout(expiresIn);
        this.fetchAndSetCurrentUser().subscribe({
          next: () => console.log('Session restored successfully.'),
          error: (err) => console.error('Failed to restore session with stored token.', err)
        });
      } else {
        // Token'ın süresi dolmuş.
        this.logout();
      }
    }
  }

  /**
   * GÜNCELLENDİ: Login sonrası /me endpoint'ini çağırır.
   */
  login(loginData: LoginRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${this.AUTH_API_URL}/login`, loginData)
      .pipe(
        // switchMap ile login isteği tamamlandıktan sonra fetchAndSetCurrentUser'a geçilir.
        switchMap(response => {
          this.handleToken(response); // Sadece token'ı işle
          return this.fetchAndSetCurrentUser(); // Kullanıcı verisini çek ve state'i ayarla
        }),
        catchError(error => {
          console.error('Login error:', error);
          return throwError(() => new Error(error.error?.message || 'Login failed. Please check your credentials.'));
        })
      );
  }

  /**
   * GÜNCELLENDİ: Register sonrası /me endpoint'ini çağırır.
   */
  register(registerData: RegisterRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${this.AUTH_API_URL}/register`, registerData)
      .pipe(
        switchMap(response => {
          this.handleToken(response); // Sadece token'ı işle
          return this.fetchAndSetCurrentUser(); // Kullanıcı verisini çek ve state'i ayarla
        }),
        catchError(error => {
          console.error('Registration error:', error);
          return throwError(() => new Error(error.error?.message || 'Registration failed. Please try again.'));
        })
      );
  }

  /**
   * YENİ (handleAuthentication'dan ayrıştırıldı): Sadece token ve zamanlayıcıyı yönetir.
   */
  private handleToken(authResponse: AuthResponse): void {
    if (!authResponse.token) {
        // Bu durumun olmaması gerekir ama güvenlik için kontrol edelim.
        throw new Error("Authentication response did not include a token.");
    }
    const expiresIn = authResponse.expiresIn || 86400; // 24 saat (saniye cinsinden)

    if (this.isBrowser) {
      localStorage.setItem('token', authResponse.token);
      const expirationDate = new Date(new Date().getTime() + expiresIn * 1000);
      localStorage.setItem('tokenExpiration', expirationDate.toISOString());
      this.autoLogout(expiresIn * 1000);
    }
  }

  /**
   * GÜNCELLENDİ: Artık localStorage'dan userData'yı temizler.
   */
  logout(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);

    if (this.isBrowser) {
      localStorage.removeItem('token');
      localStorage.removeItem('userData'); // Önceki versiyonlardan kalmış olabilecekleri temizle
      localStorage.removeItem('tokenExpiration');
    }

    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
    // Kullanıcıyı login sayfasına yönlendirmek genellikle iyi bir pratiktir.
    this.router.navigate(['/login']);
  }

  // --- DEĞİŞİKLİK GEREKTİRMEYEN YARDIMCI METOTLAR ---

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

  // Bu metot artık doğrudan kullanılmayabilir ama bir kontrol olarak kalabilir.
  checkAuthAndRedirect(): void {
    if (this.isAuthenticated()) {
      this.router.navigate(['/main-page']);
    }
  }
}