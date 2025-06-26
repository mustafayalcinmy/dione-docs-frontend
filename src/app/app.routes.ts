import { Routes } from '@angular/router';
import { MainPageComponent } from './core/components/main-page/main-page.component';
import { WelcomePageComponent } from './core/components/welcome-page/welcome-page.component';
import { LoginComponent } from './core/components/login/login.component';
import { RegisterComponent } from './core/components/register/register.component';
import { authGuard } from './core/auth/auth.guard';
import { DocumentComponent } from './core/components/document/document.component';

export const routes: Routes = [
  {
    path: '',
    component: WelcomePageComponent,
  },
  {
    path: 'main-page',
    component: MainPageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'login',
    component: LoginComponent,
     canActivate: [authGuard]
  },
  {
    path: 'register',
    component: RegisterComponent,
     canActivate: [authGuard]
  },
  {
    path: 'document',
    component: DocumentComponent,
    canActivate: [authGuard]
  },
  {
    path: 'document/:id',
    component: DocumentComponent,
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '' },
];