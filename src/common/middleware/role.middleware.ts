import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../errors';

/**
 * Role-Based Authorization Guard Middleware
 * Evaluates whether the authenticated user possesses an allowed role.
 */
export const requireRoles = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to access this resource'));
    }

    next();
  };
};

export const requireAdmin = requireRoles(Role.ADMIN);
