import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getAllChats,
  getChatById,
  getChatMessages,
  updateChat
} from '../controllers/chat.controller';

const router = Router();

// Все роуты защищены middleware авторизации
router.use(authMiddleware);

// GET /api/chats - получить все чаты клиента
router.get('/', getAllChats);

// GET /api/chats/:chatId - получить информацию о конкретном чате
router.get('/:chatId', getChatById);

// POST /api/chats/messages - получить сообщения чата (используется POST для передачи параметров)
router.post('/messages', getChatMessages);

// PATCH /api/chats/:chatId - обновить информацию о чате
router.patch('/:chatId', updateChat);

export default router;

