import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../dto/user.dto';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  user_login: LoginRequest = { email: '', password: '' };
  rememberMe: boolean = false;
  errorMessage: string | null = null;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  login() {
    this.errorMessage = null;
    console.log('Login attempt with:', this.user_login.email);

    if (this.user_login.email && this.user_login.password) {
      this.authService.login(this.user_login).subscribe({
        next: (response) => {
          console.log('Login successful!', response);
          this.router.navigate(['/main-page']);
        },
        error: (error) => {
          console.error('Login failed:', error);
          this.errorMessage = 'E-posta veya şifre yanlış. Lütfen tekrar deneyiniz.';
        }
      });
    } else {
      this.errorMessage = 'Lütfen e-posta ve şifrenizi giriniz.';
      console.error('Please enter both email and password');
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

  goToWelcome() {
    this.router.navigate(['']);
  }
}