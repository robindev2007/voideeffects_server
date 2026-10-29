import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../prisma/prisma.service';
import { AppError } from '../errors';
import type { AuthenticatedRequest } from '../types/express';
import type { Role } from '@prisma/client';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production');
    }
    return 'dev-secret-jwt-key-replace-in-env';
  }
  return secret;
};

export interface JwtPayload {
  id: string;
  email: string;
  role?: Role;
  iat?: number;
  exp?: number;
}

/**
 * Authentication Guard Middleware
 * Validates 'Authorization: Bearer <accessToken>', checks user existence,
 * and populates req.user with up-to-date database role.
 */
export const authMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication token is required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.unauthorized('Authentication token is missing');
    }

    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    if (!decoded || !decoded.id) {
      throw AppError.unauthorized('Invalid token payload');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw AppError.unauthorized('User not found or session invalid');
    }

    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(AppError.unauthorized('Authentication token has expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(AppError.unauthorized('Invalid authentication token'));
    }
    next(error);
  }
};
