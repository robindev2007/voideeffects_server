import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

describe('Chat Feature', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-jwt-key-replace-in-env';
  const testAdminId = 'usr_admin_123';
  const testUserId = 'usr_regular_456';
  const otherUserId = 'usr_other_789';
  const testConversationId = 'conv_test_123';

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

  describe('POST /chat/conversations', () => {
    it('should return 401 Unauthorized if request is unauthenticated', async () => {
      const response = await request(app).post('/chat/conversations').send({});
      expect(response.status).toBe(401);
    });

    it('should initialize or retrieve a conversation for the authenticated user', async () => {
      const findUserSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        role: Role.USER,
      } as any);

      const findConvSpy = jest.spyOn(prisma.conversation, 'findFirst').mockResolvedValueOnce({
        id: testConversationId,
        userId: testUserId,
        title: 'Support Chat',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: testUserId, name: 'Regular User', email: 'user@example.com', avatar: null },
        messages: [],
      } as any);

      const response = await request(app)
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Support Chat' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', testConversationId);
      expect(response.body.data).toHaveProperty('userId', testUserId);

      findUserSpy.mockRestore();
      findConvSpy.mockRestore();
    });
  });

  describe('GET /chat/conversations', () => {
    it('should return only own conversations for regular users', async () => {
      const findUserSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        role: Role.USER,
      } as any);

      const findManySpy = jest.spyOn(prisma.conversation, 'findMany').mockResolvedValueOnce([
        {
          id: testConversationId,
          userId: testUserId,
          title: 'My Support Chat',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: testUserId, name: 'Regular User', email: 'user@example.com', avatar: null },
          messages: [],
        },
      ] as any);

      const response = await request(app)
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: testUserId },
        }),
      );

      findUserSpy.mockRestore();
      findManySpy.mockRestore();
    });

    it('should allow admins to view all conversations', async () => {
      const findUserSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testAdminId,
        email: 'admin@example.com',
        role: Role.ADMIN,
      } as any);

      const findManySpy = jest.spyOn(prisma.conversation, 'findMany').mockResolvedValueOnce([
        {
          id: testConversationId,
          userId: testUserId,
          title: 'User 1 Support',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: testUserId, name: 'User 1', email: 'u1@example.com', avatar: null },
          messages: [],
        },
        {
          id: 'conv_other_456',
          userId: otherUserId,
          title: 'User 2 Support',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: otherUserId, name: 'User 2', email: 'u2@example.com', avatar: null },
          messages: [],
        },
      ] as any);

      const response = await request(app)
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );

      findUserSpy.mockRestore();
      findManySpy.mockRestore();
    });
  });

  describe('GET /chat/conversations/:id/messages', () => {
    it('should return 403 Forbidden when a user accesses another users conversation', async () => {
      const findUserSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        role: Role.USER,
      } as any);

      const findConvSpy = jest.spyOn(prisma.conversation, 'findUnique').mockResolvedValueOnce({
        id: 'conv_other_456',
        userId: otherUserId, // belongs to someone else!
        title: 'Other User Chat',
        user: { id: otherUserId, name: 'Other', email: 'other@example.com', avatar: null },
      } as any);

      const response = await request(app)
        .get('/chat/conversations/conv_other_456/messages')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');

      findUserSpy.mockRestore();
      findConvSpy.mockRestore();
    });

    it('should return messages in chronological order for conversation owner', async () => {
      const findUserSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        role: Role.USER,
      } as any);

      const findConvSpy = jest.spyOn(prisma.conversation, 'findUnique').mockResolvedValueOnce({
        id: testConversationId,
        userId: testUserId,
        user: { id: testUserId, name: 'Regular User', email: 'user@example.com', avatar: null },
      } as any);

      const mockMessages = [
        {
          id: 'msg_1',
          conversationId: testConversationId,
          senderId: testUserId,
          content: 'Hello Admin',
          createdAt: new Date('2026-10-28T10:00:00Z'),
          sender: { id: testUserId, name: 'Regular User', role: Role.USER, avatar: null },
        },
        {
          id: 'msg_2',
          conversationId: testConversationId,
          senderId: testAdminId,
          content: 'Hello! How can I help you today?',
          createdAt: new Date('2026-10-28T10:01:00Z'),
          sender: { id: testAdminId, name: 'System Admin', role: Role.ADMIN, avatar: null },
        },
      ];

      const findMessagesSpy = jest
        .spyOn(prisma.message, 'findMany')
        .mockResolvedValueOnce(mockMessages as any);

      const response = await request(app)
        .get(`/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].content).toBe('Hello Admin');
      expect(response.body.data[1].content).toBe('Hello! How can I help you today?');

      findUserSpy.mockRestore();
      findConvSpy.mockRestore();
      findMessagesSpy.mockRestore();
    });
  });

  describe('POST /chat/conversations/:id/messages', () => {
    it('should return 400 Bad Request when message content is empty', async () => {
      const findUserSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        role: Role.USER,
      } as any);

      const response = await request(app)
        .post(`/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: '' });

      expect(response.status).toBe(400);
      findUserSpy.mockRestore();
    });

    it('should persist message to database and update conversation timestamp', async () => {
      const findUserSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        role: Role.USER,
      } as any);

      const findConvSpy = jest.spyOn(prisma.conversation, 'findUnique').mockResolvedValueOnce({
        id: testConversationId,
        userId: testUserId,
        user: { id: testUserId, name: 'Regular User', email: 'user@example.com', avatar: null },
      } as any);

      const createMsgSpy = jest.spyOn(prisma.message, 'create').mockResolvedValueOnce({
        id: 'msg_new_999',
        conversationId: testConversationId,
        senderId: testUserId,
        content: 'I need assistance with video render',
        createdAt: new Date(),
        sender: { id: testUserId, name: 'Regular User', email: 'user@example.com', role: Role.USER, avatar: null },
      } as any);

      const updateConvSpy = jest.spyOn(prisma.conversation, 'update').mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post(`/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'I need assistance with video render' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'msg_new_999');
      expect(response.body.data.content).toBe('I need assistance with video render');
      expect(updateConvSpy).toHaveBeenCalled();

      findUserSpy.mockRestore();
      findConvSpy.mockRestore();
      createMsgSpy.mockRestore();
      updateConvSpy.mockRestore();
    });
  });

  describe('GET /chat/conversations/:id/token', () => {
    it('should generate a LiveKit room token for authorized participants', async () => {
      const findUserSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: testUserId,
        email: 'user@example.com',
        name: 'Regular User',
        role: Role.USER,
      } as any);

      const findConvSpy = jest.spyOn(prisma.conversation, 'findUnique').mockResolvedValueOnce({
        id: testConversationId,
        userId: testUserId,
        user: { id: testUserId, name: 'Regular User', email: 'user@example.com', avatar: null },
      } as any);

      const response = await request(app)
        .get(`/chat/conversations/${testConversationId}/token`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('wsUrl');
      expect(response.body.data).toHaveProperty('room', `conversation_${testConversationId}`);

      findUserSpy.mockRestore();
      findConvSpy.mockRestore();
    });
  });
});
