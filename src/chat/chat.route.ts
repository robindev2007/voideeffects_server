import { Router } from 'express';
import { chatController } from './chat.controller';
import { authMiddleware } from '../common/middleware';

const router = Router();

// All chat routes require JWT authentication
router.use(authMiddleware);

// Start or get user's support conversation with admin
router.post('/conversations', (req, res, next) => {
  chatController.startConversation(req, res).catch(next);
});

// List conversations (Admin: all, User: own)
router.get('/conversations', (req, res, next) => {
  chatController.listConversations(req, res).catch(next);
});

// Get messages for a conversation (chronological)
router.get('/conversations/:id/messages', (req, res, next) => {
  chatController.getMessages(req, res).catch(next);
});

// Send message to a conversation (persisted to DB & broadcast via LiveKit)
router.post('/conversations/:id/messages', (req, res, next) => {
  chatController.sendMessage(req, res).catch(next);
});

// Get LiveKit room access token for real-time messaging
router.get('/conversations/:id/token', (req, res, next) => {
  chatController.getLiveKitToken(req, res).catch(next);
});

export const chatRouter = router;
