import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

describe('Auth Feature', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-jwt-key-replace-in-env';
  const testAdminId = 'usr_admin_123';
  const testUserId = 'usr_regular_456';

  let adminToken: string;
  let userToken: string;

  beforeAll(() => {
    adminToken = jwt.sign({ id: testAdminId, email: 'admin@example.com' }, JWT_SECRET, {
      expiresIn: '1h',
    });
    userToken = jwt.sign({ id: testUserId, email: 'user@example.com' }, JWT_SECRET, {
      expiresIn: '1h',
    });
  });

  describe('POST /auth/login', () => {
    it('should return 400 Bad Request when required fields are missing', async () => {
      const response = await request(app).post('/auth/login').send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'BAD_REQUEST');
    });

    it('should return 401 Unauthorized when user does not exist', async () => {
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
      findSpy.mockRestore();
    });

    it('should return 400 Bad Request when user has not set password yet', async () => {
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: testUserId,
        email: 'nopw@example.com',
        name: 'No Password User',
        password: null,
        role: Role.USER,
        avatar: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'nopw@example.com', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'BAD_REQUEST');
      findSpy.mockRestore();
    });

    it('should authenticate user and return JWT access token when credentials match', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPass123!', 10);
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: testUserId,
        email: 'user@example.com',
        name: 'Regular User',
        password: hashedPassword,
        role: Role.USER,
        avatar: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'CorrectPass123!' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toEqual({
        id: testUserId,
        email: 'user@example.com',
        name: 'Regular User',
        role: Role.USER,
        avatar: null,
      });

      findSpy.mockRestore();
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 400 Bad Request when refreshToken is missing', async () => {
      const response = await request(app).post('/auth/refresh').send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'BAD_REQUEST');
    });

    it('should return 401 Unauthorized when refreshToken is invalid', async () => {
      const response = await request(app).post('/auth/refresh').send({ refreshToken: 'invalid-token' });
      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should issue new access and refresh tokens when valid refreshToken is provided', async () => {
      const refreshSecret = process.env.JWT_REFRESH_SECRET || (JWT_SECRET + '_refresh');
      const validRefreshToken = jwt.sign({ id: testUserId, email: 'user@example.com' }, refreshSecret, {
        expiresIn: '7d',
      });

      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: testUserId,
        email: 'user@example.com',
        name: 'Regular User',
        role: Role.USER,
        avatar: null,
      } as any);

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      findSpy.mockRestore();
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 Unauthorized when no Authorization header is provided', async () => {
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return 200 OK with authenticated user profile', async () => {
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        name: 'Regular User',
        password: 'hashedpassword',
        role: Role.USER,
        avatar: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', testUserId);
      expect(response.body.data).toHaveProperty('role', Role.USER);
      findSpy.mockRestore();
    });
  });

  describe('POST /auth/change-password', () => {
    it('should return 401 Unauthorized if unauthenticated', async () => {
      const response = await request(app)
        .post('/auth/change-password')
        .send({ newPassword: 'NewPassword123!' });

      expect(response.status).toBe(401);
    });

    it('should allow user to change their password when providing correct current password', async () => {
      const currentHashed = await bcrypt.hash('OldPassword123!', 10);
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        name: 'Regular User',
        password: currentHashed,
        role: Role.USER,
        avatar: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const updateSpy = jest.spyOn(prisma.user, 'update').mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'BrandNewPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testUserId },
        }),
      );

      findSpy.mockRestore();
      updateSpy.mockRestore();
    });
  });

  describe('POST /auth/admin/change-password', () => {
    it('should return 403 Forbidden when a regular user attempts admin password change', async () => {
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: testUserId,
        email: 'user@example.com',
        role: Role.USER,
      } as any);

      const response = await request(app)
        .post('/auth/admin/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: 'target-user-id',
          newPassword: 'ForcedNewPassword123!',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');
      findSpy.mockRestore();
    });

    it('should allow an admin to change another user password without old password', async () => {
      const findSpy = jest
        .spyOn(prisma.user, 'findUnique')
        // First call for authMiddleware role check
        .mockResolvedValueOnce({
          id: testAdminId,
          email: 'admin@example.com',
          role: Role.ADMIN,
        } as any)
        // Second call for finding target user
        .mockResolvedValueOnce({
          id: 'target-user-id',
          email: 'target@example.com',
          name: 'Target User',
          password: 'oldpasshash',
          role: Role.USER,
        } as any);

      const updateSpy = jest.spyOn(prisma.user, 'update').mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/auth/admin/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'target-user-id',
          newPassword: 'ForcedNewPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-user-id' },
        }),
      );

      findSpy.mockRestore();
      updateSpy.mockRestore();
    });
  });
});
