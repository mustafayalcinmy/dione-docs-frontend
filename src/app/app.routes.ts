import { Routes } from '@angular/router'; // Sadece Routes import edildi
import { MainPageComponent } from './core/components/main-page/main-page.component';
import { WelcomePageComponent } from './core/components/welcome-page/welcome-page.component';
import { LoginComponent } from './core/components/login/login.component';
import { RegisterComponent } from './core/components/register/register.component';
import { authGuard } from './core/auth/auth.guard';
import { DocumentComponent } from './core/components/document/document.component';

// NgModule tanımı kaldırıldı
export const routes: Routes = [
  {
    path: '',
    component: WelcomePageComponent,
    // canActivate: [authGuard] // Welcome sayfası guard'sız olmalı
  },
  {
    path: 'main-page',
    component: MainPageComponent,
    canActivate: [authGuard] // Ana sayfa korumalı
  },
  {
    path: 'login',
    component: LoginComponent,
     canActivate: [authGuard] // Login sayfası guard'lı (giriş yapmışsa anasayfaya yönlendirir)
  },
  {
    path: 'register',
    component: RegisterComponent,
     canActivate: [authGuard] // Register sayfası guard'lı (giriş yapmışsa anasayfaya yönlendirir)
  },
  {
    path: 'document', // Yeni doküman için ID'siz yol
    component: DocumentComponent,
    canActivate: [authGuard]
  },
  {
    path: 'document/:id', // Mevcut doküman için ID'li yol
    component: DocumentComponent,
    canActivate: [authGuard]
  },
  // EditComponent için bir route eklenmemiş, gerekirse buraya ekleyin:
  // { path: 'edit/:id', component: EditComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }, // Diğer tüm yolları welcome'a yönlendir
];

// @NgModule({...}) bloğu tamamen silindi.