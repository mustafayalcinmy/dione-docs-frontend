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
// core/dto/user.dto.ts dosyanıza ekleyin

export interface BackendUserResponse {
  userId: string;
  email: string;
  fullName: string;
}

// Mevcut User interface'iniz (değişiklik yok)
export interface User {
  id: string;
  email: string;
  fullName: string;
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