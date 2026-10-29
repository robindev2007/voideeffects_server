import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/prisma.service';
import { AppError } from '../common/errors';
import { usersService } from '../users/users.service';
import type { AdminChangePasswordDto, AuthResponse, ChangePasswordDto, LoginDto } from './auth.types';

const BCRYPT_SALT_ROUNDS = 10;

const getJwtSecret = (): string => {
  return process.env.JWT_SECRET || 'dev-secret-jwt-key-replace-in-env';
};

const getJwtRefreshSecret = (): string => {
  return (
    process.env.JWT_REFRESH_SECRET ||
    (process.env.JWT_SECRET ? `${process.env.JWT_SECRET}_refresh` : 'dev-refresh-jwt-key')
  );
};

export class AuthService {
  /**
   * Authenticates user with email and password, issuing access & refresh tokens.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await usersService.findByEmail(dto.email);

    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (!user.password) {
      throw AppError.badRequest(
        'Account password has not been set yet. Please contact an administrator or complete account setup.',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      getJwtSecret(),
      { expiresIn: '1h' },
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      getJwtRefreshSecret(),
      { expiresIn: '7d' },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Validates refresh token and issues fresh access and refresh tokens.
   */
  async refreshAccessToken(token: string): Promise<AuthResponse> {
    try {
      const decoded = jwt.verify(token, getJwtRefreshSecret()) as { id: string; email: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user) {
        throw AppError.unauthorized('User not found');
      }

      const newAccessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        getJwtSecret(),
        { expiresIn: '1h' },
      );

      const newRefreshToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        getJwtRefreshSecret(),
        { expiresIn: '7d' },
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
        },
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.unauthorized('Invalid or expired refresh token');
    }
  }

  /**
   * Allows any logged-in user to change or set their own password.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (user.password) {
      if (!dto.currentPassword) {
        throw AppError.badRequest('Current password is required to change password');
      }

      const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isCurrentValid) {
        throw AppError.badRequest('Current password is incorrect');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  /**
   * Allows an administrator to change another user's password.
   */
  async adminChangePassword(dto: AdminChangePasswordDto): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw AppError.notFound('Target user not found');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);

    await prisma.user.update({
      where: { id: dto.userId },
      data: { password: hashedPassword },
    });
  }

  /**
   * Retrieves profile for currently authenticated user.
   */
  async getMe(userId: string) {
    return usersService.findById(userId);
  }
}

export const authService = new AuthService();
