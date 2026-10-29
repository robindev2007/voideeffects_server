import type { Role } from '@prisma/client';

export interface ChatSender {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
}

export interface ChatMessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  sender: ChatSender;
  content: string;
  createdAt: Date;
}

export interface ConversationResponse {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  lastMessage?: ChatMessageResponse | null;
}

export interface LiveKitTokenResponse {
  token: string;
  wsUrl: string;
  room: string;
}
