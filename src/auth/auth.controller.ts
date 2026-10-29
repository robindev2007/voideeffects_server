import type { Request, Response } from 'express';
import { authService } from './auth.service';
import { AdminChangePasswordSchema, ChangePasswordSchema, LoginSchema, RefreshTokenSchema } from './auth.dto';
import { ApiResponse } from '../common/utils';
import type { AuthenticatedRequest } from '../common/types/express';

export class AuthController {
  /**
   * Public login with email & password.
   */
  async login(req: Request, res: Response): Promise<void> {
    const validatedDto = LoginSchema.parse(req.body);
    const result = await authService.login(validatedDto);
    ApiResponse.success(res, result, { message: 'Logged in successfully' });
  }

  /**
   * Public refresh token endpoint.
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    const validatedDto = RefreshTokenSchema.parse(req.body);
    const result = await authService.refreshAccessToken(validatedDto.refreshToken);
    ApiResponse.success(res, result, { message: 'Token refreshed successfully' });
  }

  /**
   * Authenticated user info.
   */
  async getMe(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthenticatedRequest).user.id;
    const user = await authService.getMe(userId);
    ApiResponse.success(res, user);
  }

  /**
   * Change own password (authenticated user).
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthenticatedRequest).user.id;
    const validatedDto = ChangePasswordSchema.parse(req.body);
    await authService.changePassword(userId, validatedDto);
    ApiResponse.success(res, null, { message: 'Password updated successfully' });
  }

  /**
   * Admin-only: change another user's password.
   */
  async adminChangePassword(req: Request, res: Response): Promise<void> {
    const validatedDto = AdminChangePasswordSchema.parse(req.body);
    await authService.adminChangePassword(validatedDto);
    ApiResponse.success(res, null, { message: 'User password updated successfully' });
  }
}

export const authController = new AuthController();
