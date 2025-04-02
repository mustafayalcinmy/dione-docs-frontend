export interface LoginRequest {
  email: string;
  password: string;
}

// Interface for registration request payload
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

// Interface for auth response
export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  fullName: string;
  expiresIn?: number;
}

// Interface for user data
export interface User {
  id: string;
  email: string;
  fullName: string;
}