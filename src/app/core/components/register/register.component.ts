import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { RegisterRequest } from '../../dto/user.dto';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  user_register: RegisterRequest = { username: '', email: '', password: '' };
  confirmPassword: string = '';
  acceptTerms: boolean = false;
  errorMessage: string | null = null;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  isFormValid(): boolean {
    return this.user_register.username.trim() !== '' &&
           this.isValidEmail() &&
           this.isPasswordStrong() &&
           this.user_register.password === this.confirmPassword &&
           this.acceptTerms;
  }

  isValidEmail(): boolean {
    const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return emailPattern.test(this.user_register.email);
  }

  isPasswordStrong(): boolean {
    const password = this.user_register.password;
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return password.length >= 8 && hasNumber && hasSpecialChar;
  }
  
  register() {
    this.errorMessage = null

    if (!this.user_register.username.trim() || !this.user_register.email.trim() || !this.user_register.password) {
      this.errorMessage = 'Lütfen tüm zorunlu alanları doldurun.';
      return;
    }
    if (!this.isValidEmail()) {
      this.errorMessage = 'Lütfen geçerli bir e-posta adresi girin.';
      return;
    }
    if (!this.isPasswordStrong()) {
        this.errorMessage = 'Şifre en az 8 karakter olmalı, sayı ve özel karakter içermelidir.';
        return;
    }
    if (this.user_register.password !== this.confirmPassword) {
      this.errorMessage = 'Girdiğiniz şifreler uyuşmuyor.';
      return;
    }
    if (!this.acceptTerms) {
      this.errorMessage = 'Devam etmek için kullanım koşullarını kabul etmelisiniz.';
      return;
    }

    this.authService.register(this.user_register).subscribe({
      next: (response) => {
        console.log('Register successful!', response);
        this.router.navigate(['/main-page']);
      },
      error: (error) => {
        console.error('Register failed:', error);
        this.errorMessage = 'Kayıt sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin veya daha sonra tekrar deneyin.';
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToWelcome() {
    this.router.navigate(['']);
  }
}