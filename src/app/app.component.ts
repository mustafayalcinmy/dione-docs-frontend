import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router'; // RouterOutlet import edildi

@Component({
  selector: 'app-root',
  standalone: true, // standalone eklendi
  imports: [RouterOutlet], // RouterOutlet import edildi
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'dione-docs';
}