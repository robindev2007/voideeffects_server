import type { z } from 'zod';
import type { Role } from '@prisma/client';
import type { CreateUserSchema, UpdateProfileSchema } from './users.dto';

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar: string | null;
  bio: string | null;
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}
