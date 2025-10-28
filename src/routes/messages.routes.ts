import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  sendMessage,
  sendMassMessage,
  sendBroadcastMessage,
  getMessageHistory,
  toggleAdminChatMode
} from '../controllers/messages.controller';

const router = Router();

// Все роуты защищены middleware авторизации
router.use(authMiddleware);

// POST /api/messages/send - отправить одиночное сообщение
router.post('/send', sendMessage);

// POST /api/messages/mass - массовая отправка сообщений
router.post('/mass', sendMassMessage);

// POST /api/messages/broadcast - отправка broadcast сообщения всем пользователям
router.post('/broadcast', sendBroadcastMessage);

// GET /api/messages/history/:chatId - получить историю сообщений
router.get('/history/:chatId', getMessageHistory);

// PUT /api/messages/admin-chat-mode - включить/выключить режим прямого общения с админом
router.put('/admin-chat-mode', toggleAdminChatMode);

export default router;

