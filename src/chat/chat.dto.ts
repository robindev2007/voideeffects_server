import { z } from 'zod';

export const SendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content cannot be empty').max(2000, 'Message is too long (max 2000 chars)'),
});

export const StartConversationSchema = z.object({
  title: z.string().trim().max(100).optional(),
});
