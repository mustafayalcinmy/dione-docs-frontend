import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { User } from '../dto/user.dto';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  password?: string;
  profilePicture?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly API_URL = 'https://api.dionedocs.com'; // Replace with your actual API URL

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Get user profile data
  getUserProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.API_URL}/users/profile`)
      .pipe(
        catchError(error => {
          console.error('Error fetching user profile:', error);
          return throwError(() => new Error(error.error?.message || 'Failed to load user profile'));
        })
      );
  }

  // Update user profile
  updateProfile(profileData: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.API_URL}/users/profile`, profileData)
      .pipe(
        tap(updatedProfile => {
          // If the user updated their name or email, update the stored user data
          const currentUser = this.authService.getCurrentUser();
          if (currentUser && (profileData.fullName || profileData.email)) {
            const updatedUser: User = {
              ...currentUser,
              fullName: profileData.fullName || currentUser.fullName,
              email: profileData.email || currentUser.email
            };
            
            // Update local storage with new user data
            localStorage.setItem('userData', JSON.stringify(updatedUser));
          }
        }),
        catchError(error => {
          console.error('Error updating profile:', error);
          return throwError(() => new Error(error.error?.message || 'Failed to update profile'));
        })
      );
  }

  // Change password
  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.API_URL}/users/change-password`, {
      currentPassword,
      newPassword
    }).pipe(
      catchError(error => {
        console.error('Error changing password:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to change password'));
      })
    );
  }

  // Request password reset
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/forgot-password`, { email })
      .pipe(
        catchError(error => {
          console.error('Error requesting password reset:', error);
          return throwError(() => new Error(error.error?.message || 'Failed to request password reset'));
        })
      );
  }

  // Reset password with token
  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/reset-password`, {
      token,
      newPassword
    }).pipe(
      catchError(error => {
        console.error('Error resetting password:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to reset password'));
      })
    );
  }

  // Delete user account
  deleteAccount(password: string): Observable<any> {
    return this.http.post(`${this.API_URL}/users/delete-account`, { password })
      .pipe(
        tap(() => {
          // Log out user after account deletion
          this.authService.logout();
        }),
        catchError(error => {
          console.error('Error deleting account:', error);
          return throwError(() => new Error(error.error?.message || 'Failed to delete account'));
        })
      );
  }
}