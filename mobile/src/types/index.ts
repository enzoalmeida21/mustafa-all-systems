// Tipos locais para o mobile (cópia dos tipos compartilhados)
// Isso evita problemas de resolução de caminho no React Native

export enum UserRole {
  PROMOTER = 'PROMOTER',
  SUPERVISOR = 'SUPERVISOR',
  INDUSTRY_OWNER = 'INDUSTRY_OWNER',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

