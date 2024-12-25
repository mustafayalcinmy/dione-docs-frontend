import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { MatIconModule } from '@angular/material/icon';
import { MainPageComponent } from './core/components/main-page/main-page.component';
import { MatTableModule } from '@angular/material/table'; // MatTableModule
import { MatButtonModule } from '@angular/material/button'; // MatButtonModule
import { MatPaginatorModule } from '@angular/material/paginator';  // Paginator modülünü ekleyin
@NgModule({
  declarations: [
    AppComponent,
    MainPageComponent
  ],
  imports: [
    BrowserModule,
    MatIconModule,
    MatTableModule,
    MatButtonModule,
    MatPaginatorModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
