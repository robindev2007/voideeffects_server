import { AccessToken, DataPacket_Kind, RoomServiceClient } from 'livekit-server-sdk';
import { prisma } from '../prisma/prisma.service';
import { AppError } from '../common/errors';
import { logger } from '../common/logger';
import { Role } from '@prisma/client';
import type { ChatMessageResponse, ConversationResponse, LiveKitTokenResponse } from './chat.types';

export class ChatService {
  private roomService: RoomServiceClient | null = null;

  constructor() {
    const livekitUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (livekitUrl && apiKey && apiSecret) {
      // LiveKit server client expects HTTP/HTTPS endpoint rather than wss://
      const httpHost = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      this.roomService = new RoomServiceClient(httpHost, apiKey, apiSecret);
    }
  }

  /**
   * Helper to verify if user has access to the conversation.
   * Admins can access all conversations; regular users can only access their own.
   */
  private async verifyConversationAccess(
    conversationId: string,
    userId: string,
    role: Role,
  ) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    if (!conversation) {
      throw AppError.notFound('Conversation not found');
    }

    if (role !== Role.ADMIN && conversation.userId !== userId) {
      throw AppError.forbidden('You do not have permission to access this conversation');
    }

    return conversation;
  }

  /**
   * Finds or creates a conversation between the requesting user and administration.
   */
  async getOrCreateUserConversation(userId: string, title?: string): Promise<ConversationResponse> {
    let conversation = await prisma.conversation.findFirst({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: title || 'Support Chat',
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
          messages: {
            take: 1,
            include: {
              sender: { select: { id: true, name: true, email: true, role: true, avatar: true } },
            },
          },
        },
      });
    }

    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      user: conversation.user,
      lastMessage: (conversation.messages[0] as unknown as ChatMessageResponse) || null,
    };
  }

  /**
   * Lists conversations.
   * Admins see all user conversations.
   * Regular users only see their own conversation.
   */
  async listConversations(userId: string, role: Role): Promise<ConversationResponse[]> {
    const whereClause = role === Role.ADMIN ? {} : { userId };

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          },
        },
      },
    });

    return conversations.map((conv) => ({
      id: conv.id,
      userId: conv.userId,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      user: conv.user,
      lastMessage: (conv.messages[0] as unknown as ChatMessageResponse) || null,
    }));
  }

  /**
   * Retrieves messages for a conversation in chronological order.
   */
  async getMessages(
    conversationId: string,
    userId: string,
    role: Role,
  ): Promise<ChatMessageResponse[]> {
    await this.verifyConversationAccess(conversationId, userId, role);

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
      },
    });

    return messages as unknown as ChatMessageResponse[];
  }

  /**
   * Persists a message to the database and broadcasts it over LiveKit real-time channel.
   */
  async sendMessage(
    conversationId: string,
    userId: string,
    role: Role,
    content: string,
  ): Promise<ChatMessageResponse> {
    await this.verifyConversationAccess(conversationId, userId, role);

    // Persist message in database
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
      },
    });

    // Touch conversation updated timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Broadcast message payload via LiveKit room data channel if server connection is active
    if (this.roomService) {
      const roomName = `conversation_${conversationId}`;
      const payload = Buffer.from(JSON.stringify(message));

      try {
        await this.roomService.sendData(roomName, payload, DataPacket_Kind.RELIABLE, {
          topic: 'chat',
        });
      } catch (broadcastErr) {
        logger.warn('LiveKit data broadcast failed or no active participants', {
          roomName,
          error: (broadcastErr as Error).message,
        });
      }
    }

    return message as unknown as ChatMessageResponse;
  }

  /**
   * Generates a secure LiveKit Room Access Token for real-time messaging.
   */
  async getLiveKitToken(
    conversationId: string,
    userId: string,
    role: Role,
    userName: string,
  ): Promise<LiveKitTokenResponse> {
    await this.verifyConversationAccess(conversationId, userId, role);

    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret_1234567890_voideffects_livekit';
    const wsUrl = process.env.LIVEKIT_URL || 'wss://voideffects.livekit.cloud';
    const roomName = `conversation_${conversationId}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: userName,
      metadata: JSON.stringify({ role, conversationId }),
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return {
      token,
      wsUrl,
      room: roomName,
    };
  }
}

export const chatService = new ChatService();
