import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const isAuthenticated = authService.isAuthenticated();


    const blockedRoutes = ['login', 'register', ''];
    if (isAuthenticated && blockedRoutes.includes(route.url[0]?.path || '')) {
      router.navigate(['/main-page']);
      return false;
    }
    if (!isAuthenticated && state.url === '/main-page') {
        router.navigate(['/login']);
        return false;
    }
      return true;
};

