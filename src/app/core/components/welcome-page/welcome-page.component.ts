import { Component, OnInit } from '@angular/core'; // OnInit import edildi
import { Router, RouterModule } from '@angular/router'; // RouterModule import edildi
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common'; // CommonModule import edildi

@Component({
  selector: 'app-welcome-page',
  standalone: true, // standalone eklendi
  imports: [RouterModule, CommonModule], // Gerekli modüller eklendi
  templateUrl: './welcome-page.component.html',
  styleUrls: ['./welcome-page.component.scss']
})
export class WelcomePageComponent implements OnInit { // OnInit implement edildi
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Auth check logic is good
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/main-page']);
    }
  }

  goToLogin() {
    this.router.navigate(['/login']); // Rota düzeltildi
  }
  goToRegister() {
    this.router.navigate(['/register']); // Rota düzeltildi
  }
}