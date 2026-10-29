import type { Request, Response } from 'express';
import { chatService } from './chat.service';
import { SendMessageSchema, StartConversationSchema } from './chat.dto';
import { ApiResponse } from '../common/utils';
import type { AuthenticatedRequest } from '../common/types/express';

export class ChatController {
  /**
   * Start or retrieve the user's conversation with admin.
   */
  async startConversation(req: Request, res: Response): Promise<void> {
    const user = (req as AuthenticatedRequest).user;
    const validatedDto = StartConversationSchema.parse(req.body);
    const conversation = await chatService.getOrCreateUserConversation(user.id, validatedDto.title);
    ApiResponse.success(res, conversation, { message: 'Conversation initialized' });
  }

  /**
   * List conversations (all for admin, own for user).
   */
  async listConversations(req: Request, res: Response): Promise<void> {
    const user = (req as AuthenticatedRequest).user;
    const conversations = await chatService.listConversations(user.id, user.role);
    ApiResponse.success(res, conversations);
  }

  /**
   * Get all messages for a specific conversation.
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    const user = (req as AuthenticatedRequest).user;
    const conversationId = req.params.id as string;
    const messages = await chatService.getMessages(conversationId, user.id, user.role);
    ApiResponse.success(res, messages);
  }

  /**
   * Send a new message to a conversation.
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    const user = (req as AuthenticatedRequest).user;
    const conversationId = req.params.id as string;
    const validatedDto = SendMessageSchema.parse(req.body);
    const message = await chatService.sendMessage(
      conversationId,
      user.id,
      user.role,
      validatedDto.content,
    );
    ApiResponse.created(res, message, { message: 'Message sent successfully' });
  }

  /**
   * Issue a LiveKit token to connect to real-time messaging room.
   */
  async getLiveKitToken(req: Request, res: Response): Promise<void> {
    const user = (req as AuthenticatedRequest).user;
    const conversationId = req.params.id as string;
    const tokenData = await chatService.getLiveKitToken(
      conversationId,
      user.id,
      user.role,
      user.email,
    );
    ApiResponse.success(res, tokenData);
  }
}

export const chatController = new ChatController();
