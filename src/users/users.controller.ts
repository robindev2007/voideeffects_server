import type { Request, Response } from 'express';
import { usersService } from './users.service';
import { CreateUserSchema, UpdateProfileSchema } from './users.dto';
import { ApiResponse } from '../common/utils';
import type { AuthenticatedRequest } from '../common/types/express';

export class UsersController {
  /**
   * Admin-only endpoint: creates a user with name and email.
   */
  async createUser(req: Request, res: Response): Promise<void> {
    const validatedDto = CreateUserSchema.parse(req.body);
    const user = await usersService.createUser(validatedDto);
    ApiResponse.created(res, user, { message: 'User created successfully' });
  }

  /**
   * Returns authenticated user's own profile.
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthenticatedRequest).user.id;
    const profile = await usersService.findById(userId);
    ApiResponse.success(res, profile);
  }

  /**
   * Updates authenticated user's own profile.
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthenticatedRequest).user.id;
    const validatedDto = UpdateProfileSchema.parse(req.body);
    const updated = await usersService.updateProfile(userId, validatedDto);
    ApiResponse.success(res, updated, { message: 'Profile updated successfully' });
  }

  /**
   * Admin-only endpoint: lists all registered users with pagination & search.
   */
  async listUsers(req: Request, res: Response): Promise<void> {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const result = await usersService.getAllUsers({ search, page, limit });
    ApiResponse.paginated(res, result.users, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  }
}

export const usersController = new UsersController();
