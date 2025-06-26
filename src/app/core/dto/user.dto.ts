export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface BackendUserResponse {
  userId: string;
  email: string;
  fullName: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  fullName: string;
  expiresIn?: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
}