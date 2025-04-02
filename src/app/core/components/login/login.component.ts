import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common'; // CommonModule import edildi
import { FormsModule } from '@angular/forms'; // FormsModule import edildi
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../dto/user.dto';

@Component({
  selector: 'app-login',
  standalone: true, // standalone eklendi
  imports: [CommonModule, FormsModule], // Gerekli modüller eklendi
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  user_login: LoginRequest = { email: '', password: '' };
  rememberMe: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  login() {
    console.log('Login attempt with:', this.user_login.email);

    if (this.user_login.email && this.user_login.password) {
      this.authService.login(this.user_login).subscribe({ // Modern subscribe syntax
        next: (response) => {
          console.log('Login successful!', response);
          // Başarılı girişten sonra ana sayfaya yönlendirme
          this.router.navigate(['/main-page']); // Yönlendirme düzeltildi
        },
        error: (error) => {
          console.error('Login failed:', error);
          // Hata mesajını kullanıcıya gösterebilirsiniz (örneğin MatSnackBar ile)
        }
      });
    } else {
      console.error('Please enter both email and password');
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

  goToWelcome() {
    this.router.navigate(['']); // Welcome sayfası ana dizinde ('')
  }
}