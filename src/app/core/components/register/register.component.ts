import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common'; // CommonModule import edildi
import { FormsModule } from '@angular/forms'; // FormsModule import edildi
import { AuthService } from '../../services/auth.service';
import { RegisterRequest } from '../../dto/user.dto';

@Component({
  selector: 'app-register',
  standalone: true, // standalone eklendi
  imports: [CommonModule, FormsModule], // Gerekli modüller eklendi
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  user_register: RegisterRequest = { username: '', email: '', password: '' };
  confirmPassword: string = '';
  acceptTerms: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  isFormValid(): boolean {
    // username -> fullName olarak değiştirildi (DTO'ya göre)
    return this.user_register.username.trim() !== '' &&
           this.isValidEmail() &&
           this.user_register.password.length >= 8 && // Daha güçlü parola kontrolü eklenebilir
           this.user_register.password === this.confirmPassword &&
           this.acceptTerms;
  }

  isValidEmail(): boolean {
    const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return emailPattern.test(this.user_register.email);
  }

  register() {
    console.log('Registration attempt with:', this.user_register.email);
    if (this.isFormValid()) {
      // username DTO'da fullName olmalı, backend bunu bekliyorsa DTO güncellenmeli
      // veya RegisterRequest içindeki alan adı backend'e göre ayarlanmalı.
      // Şimdilik username kullandığını varsayıyorum. Backend fullName bekliyorsa:
      // const registerData: RegisterRequest = { fullName: this.user_register.username, ... };
      this.authService.register(this.user_register).subscribe({ // Modern subscribe syntax
        next: (response) => {
          console.log('Register successful!', response);
          // Başarılı kayıt sonrası ana sayfaya yönlendir
          this.router.navigate(['/main-page']);
        },
        error: (error) => {
          console.error('Register failed:', error);
           // Hata mesajını kullanıcıya gösterebilirsiniz
        }
      });
      // Başarısız olsa bile login'e yönlendirme kaldırıldı. Sadece başarılı olunca yönlendirilmeli.
    } else {
      console.error('Please fill out all required fields correctly');
      // Kullanıcıya hangi alanın hatalı olduğu bilgisi verilebilir.
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToWelcome() {
    this.router.navigate(['']); // Welcome sayfası ana dizinde ('')
  }
}