import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware, requireAdmin } from '../common/middleware';

const router = Router();

// Public: Login with email & password
router.post('/login', (req, res, next) => {
  authController.login(req, res).catch(next);
});

// Public: Refresh JWT access token
router.post('/refresh', (req, res, next) => {
  authController.refreshToken(req, res).catch(next);
});

// Authenticated: Get own profile details
router.get('/me', authMiddleware, (req, res, next) => {
  authController.getMe(req, res).catch(next);
});

// Authenticated: Change own password
router.post('/change-password', authMiddleware, (req, res, next) => {
  authController.changePassword(req, res).catch(next);
});

// Admin-only: Change another user's password
router.post('/admin/change-password', authMiddleware, requireAdmin, (req, res, next) => {
  authController.adminChangePassword(req, res).catch(next);
});

export const authRouter = router;
