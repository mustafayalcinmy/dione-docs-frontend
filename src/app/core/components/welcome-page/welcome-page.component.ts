import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './welcome-page.component.html',
  styleUrls: ['./welcome-page.component.scss']
})
export class WelcomePageComponent implements OnInit {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  
  ngOnInit() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/main-page']);
    }
  }


  goToLogin() {
    this.router.navigate(['/login']);
  }


  goToRegister() {
    this.router.navigate(['/register']);
  }
}