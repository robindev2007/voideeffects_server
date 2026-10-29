import { Router } from 'express';
import { usersController } from './users.controller';
import { authMiddleware, requireAdmin } from '../common/middleware';

const router = Router();

// Admin-only: create a user
router.post('/', authMiddleware, requireAdmin, (req, res, next) => {
  usersController.createUser(req, res).catch(next);
});

// Admin-only: list all users
router.get('/', authMiddleware, requireAdmin, (req, res, next) => {
  usersController.listUsers(req, res).catch(next);
});

// Authenticated user: get own profile
router.get('/profile', authMiddleware, (req, res, next) => {
  usersController.getProfile(req, res).catch(next);
});

// Authenticated user: update own profile
router.patch('/profile', authMiddleware, (req, res, next) => {
  usersController.updateProfile(req, res).catch(next);
});

export const usersRouter = router;
