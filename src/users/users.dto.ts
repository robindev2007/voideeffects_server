import { z } from 'zod';
import { Role } from '@prisma/client';

export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address').toLowerCase(),
  role: z.nativeEnum(Role).optional().default(Role.USER),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(100).optional(),
  avatar: z.string().url('Invalid avatar URL').nullable().optional(),
  bio: z.string().max(500, 'Bio exceeds maximum length of 500 characters').nullable().optional(),
});
