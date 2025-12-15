export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  nome?: string;
  phone?: string;
  document?: string;
  createdAt: Date;
  updatedAt: Date;
  isEmailVerified: boolean;
  isActive: boolean;
  role?: string;
}

export interface UserRegistration {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  document?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
    refreshToken: string;
    expiresIn: number;
  };
  error?: {
    message: string;
    code?: string;
  };
}
