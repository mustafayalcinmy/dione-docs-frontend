import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn, // HttpHandler yerine HttpHandlerFn kullanılabilir (opsiyonel)
  HttpInterceptorFn, // Fonksiyonel interceptor tipi
  HttpEvent,
  HttpErrorResponse,
  HttpHandler, // Class interceptor için HttpHandler
  HttpInterceptor
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

// Class-based interceptor olarak kalabilir
@Injectable({ providedIn: 'root' }) // providedIn: 'root' kalabilir, zararı olmaz.
export class AuthInterceptor implements HttpInterceptor { // HttpInterceptor implement ediliyor
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(private authService: AuthService, private router: Router) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> { // next: HttpHandler
    const token = this.authService.getToken();

    // Token yoksa ve istek korumalı olmayan bir API'ye gitmiyorsa
    // (örneğin /login veya /register API'si değilse) login'e yönlendirme yapılabilir.
    // Ancak API isteği yapmadan önce token kontrolü burada yapılıyor.
    // Belki de token ekleyip 401 hatasını beklemek daha standart bir yaklaşımdır.
    // Şimdilik mevcut mantığı koruyalım.
    // if (!token && !request.url.includes('/login') && !request.url.includes('/register')) {
    //    this.router.navigate(['/login']); // veya /welcome
    //    return throwError(() => new Error('No token found, redirecting.'));
    // }


    // Token varsa isteğe ekle
    if (token) {
        request = this.addTokenToRequest(request, token);
        console.log('Token added to request for:', request.url); // Hangi isteğe token eklendiğini logla
    } else {
        console.log('No token found for request:', request.url); // Token olmayan istekleri logla
    }


    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          // Token geçersiz veya süresi dolmuş
          console.error('401 Unauthorized error caught by interceptor.');
          return this.handle401Error(request, next);
        }
        // Diğer hatalar
        return throwError(() => error);
      })
    );
  }

  private addTokenToRequest(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // 401 hatasını ele alma (Refresh token mekanizması buraya eklenebilir)
  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
     // Basitçe logout yapıp login'e yönlendiriyoruz
     console.log('Handling 401 Error: Logging out and redirecting to login.');
     this.authService.logout();
     this.router.navigate(['/login']); // Otomatik olarak login sayfasına yönlendir

     // Hatayı sonlandırıyoruz, tekrar deneme (retry) yapmıyoruz
     return throwError(() => new Error('Session expired or invalid. Please login again.'));

     // --- Refresh Token Mekanizması (Daha İleri Seviye) ---
     // if (!this.isRefreshing) {
     //   this.isRefreshing = true;
     //   this.refreshTokenSubject.next(null);
     //
     //   return this.authService.refreshToken().pipe( // refreshToken() serviste tanımlanmalı
     //     switchMap((tokenResponse: any) => {
     //       this.isRefreshing = false;
     //       this.refreshTokenSubject.next(tokenResponse.token);
     //       return next.handle(this.addTokenToRequest(request, tokenResponse.token));
     //     }),
     //     catchError((err) => {
     //       this.isRefreshing = false;
     //       this.authService.logout();
     //       this.router.navigate(['/login']);
     //       return throwError(() => err);
     //     })
     //   );
     // } else {
     //   // Eğer refresh token işlemi zaten devam ediyorsa, yeni token'ı bekle
     //   return this.refreshTokenSubject.pipe(
     //     filter(token => token != null),
     //     take(1),
     //     switchMap(jwt => {
     //       return next.handle(this.addTokenToRequest(request, jwt));
     //     })
     //   );
     // }
     // --- Refresh Token Sonu ---
   }
}