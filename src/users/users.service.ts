import { prisma } from '../prisma/prisma.service';
import { AppError } from '../common/errors';
import type { CreateUserDto, UpdateProfileDto, UserResponse } from './users.types';
import type { User } from '@prisma/client';

export class UsersService {
  /**
   * Sanitizes a Prisma user object for API responses.
   */
  private formatUser(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      bio: user.bio,
      hasPassword: Boolean(user.password),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Creates a user in the database without a password (admin creation).
   * The user can subsequently set their password.
   */
  async createUser(dto: CreateUserDto): Promise<UserResponse> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw AppError.conflict('A user with this email address already exists');
    }

    const user = await prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        password: null,
      },
    });

    return this.formatUser(user);
  }

  /**
   * Finds a user by ID and returns the public user profile.
   */
  async findById(id: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return this.formatUser(user);
  }

  /**
   * Internal lookup by email (includes password hash for auth verification).
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Updates an existing user's profile details.
   */
  async updateProfile(id: string, dto: UpdateProfileDto): Promise<UserResponse> {
    await this.findById(id);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      },
    });

    return this.formatUser(updated);
  }

  /**
   * Retrieves users with pagination and search (for administrative management).
   */
  async getAllUsers(options?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: UserResponse[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options?.limit) || 10));
    const skip = (page - 1) * limit;

    const searchTerm = options?.search?.trim();
    const where = searchTerm
      ? {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' as const } },
            { email: { contains: searchTerm, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user) => this.formatUser(user)),
      total,
      page,
      limit,
    };
  }
}

export const usersService = new UsersService();
