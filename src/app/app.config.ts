import { ApplicationConfig, APP_INITIALIZER, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';

export function initializeAppFactory(authService: AuthService) {
  return () => authService.initializeAuth();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    importProvidersFrom(HttpClientModule),

    {
      provide: APP_INITIALIZER,
      useFactory: initializeAppFactory,
      deps: [AuthService],
      multi: true
    }
  ]
};