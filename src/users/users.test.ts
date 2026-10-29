import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

describe('Users Feature', () => {
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

  describe('POST /users (Admin User Creation)', () => {
    it('should return 401 Unauthorized if request is unauthenticated', async () => {
      const response = await request(app)
        .post('/users')
        .send({ name: 'New User', email: 'new@example.com' });

      expect(response.status).toBe(401);
    });

    it('should return 403 Forbidden when a regular user attempts to create a user', async () => {
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: testUserId,
        email: 'user@example.com',
        role: Role.USER,
      } as any);

      const response = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'New User', email: 'new@example.com' });

      expect(response.status).toBe(403);
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');
      findSpy.mockRestore();
    });

    it('should allow an admin to create a user with password unset', async () => {
      const findSpy = jest
        .spyOn(prisma.user, 'findUnique')
        // authMiddleware role check
        .mockResolvedValueOnce({
          id: testAdminId,
          email: 'admin@example.com',
          role: Role.ADMIN,
        } as any)
        // check existing email in usersService
        .mockResolvedValueOnce(null);

      const createSpy = jest.spyOn(prisma.user, 'create').mockResolvedValueOnce({
        id: 'usr_created_789',
        email: 'newuser@example.com',
        name: 'New Creator',
        password: null,
        role: Role.USER,
        avatar: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Creator', email: 'newuser@example.com' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual({
        id: 'usr_created_789',
        email: 'newuser@example.com',
        name: 'New Creator',
        role: Role.USER,
        avatar: null,
        bio: null,
        hasPassword: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      findSpy.mockRestore();
      createSpy.mockRestore();
    });
  });

  describe('GET /users/profile', () => {
    it('should return 401 Unauthorized when no token is provided', async () => {
      const response = await request(app).get('/users/profile');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 200 OK with user profile for authenticated user', async () => {
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        name: 'Jane Doe',
        password: 'hashedpassword',
        role: Role.USER,
        avatar: 'https://avatar.example.com/jane.jpg',
        bio: 'Video editor enthusiast',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get('/users/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual({
        id: testUserId,
        email: 'user@example.com',
        name: 'Jane Doe',
        role: Role.USER,
        avatar: 'https://avatar.example.com/jane.jpg',
        bio: 'Video editor enthusiast',
        hasPassword: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      findSpy.mockRestore();
    });
  });

  describe('PATCH /users/profile', () => {
    it('should return 400 Bad Request when payload is invalid', async () => {
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: testUserId,
        email: 'user@example.com',
        role: Role.USER,
      } as any);

      const response = await request(app)
        .patch('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ avatar: 'not-a-valid-url' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      findSpy.mockRestore();
    });

    it('should update profile and return updated data', async () => {
      const findSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        name: 'Jane Doe',
        password: 'hashedpassword',
        role: Role.USER,
        avatar: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updateSpy = jest.spyOn(prisma.user, 'update').mockResolvedValueOnce({
        id: testUserId,
        email: 'user@example.com',
        name: 'Jane Smith',
        password: 'hashedpassword',
        role: Role.USER,
        avatar: null,
        bio: 'Creator & editor',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .patch('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Jane Smith',
          bio: 'Creator & editor',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.name).toBe('Jane Smith');
      expect(response.body.data.bio).toBe('Creator & editor');

      findSpy.mockRestore();
      updateSpy.mockRestore();
    });
  });
});
