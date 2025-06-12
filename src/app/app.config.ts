// Dosya: src/app/app.config.ts

import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';

// YENİ: HttpClient ve Interceptor'lar için gerekli importlar
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { AuthInterceptor } from './core/interceptors/auth.interceptor'; // YENİ: Interceptor'ı import edin

export function initializeAppFactory(authService: AuthService) {
  return () => authService.initializeAuth();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    // YENİ: HttpClient'ı ve Interceptor'ları modern ve doğru şekilde tanıtma
    provideHttpClient(withInterceptorsFromDi()), 

    {
      // Bu bölüm, AuthInterceptor'ın bir HTTP_INTERCEPTOR olarak tanınmasını sağlar
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    // --- YENİ KISIM SONU ---

    {
      provide: APP_INITIALIZER,
      useFactory: initializeAppFactory,
      deps: [AuthService],
      multi: true
    }
  ]
};