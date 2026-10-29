import type { z } from 'zod';
import type { Role } from '@prisma/client';
import type { LoginSchema, ChangePasswordSchema, AdminChangePasswordSchema, RefreshTokenSchema } from './auth.dto';

export type LoginDto = z.infer<typeof LoginSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type AdminChangePasswordDto = z.infer<typeof AdminChangePasswordSchema>;

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar: string | null;
}

export interface AuthResponse {
  user: AuthUserResponse;
  accessToken: string;
  refreshToken: string;
}
