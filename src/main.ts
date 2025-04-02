import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component'; // Standalone AppComponent import ediliyor

bootstrapApplication(AppComponent, appConfig) // Standalone AppComponent ve config ile başlatılıyor
  .catch((err) => console.error(err));