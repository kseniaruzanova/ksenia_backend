import { Router } from 'express';
import { sendSingleMessage, sendMassMessage, getMessageLogs, broadcastMessage, checkBotStatus, sendMessageFromN8N, getBotManagerStats, syncBotManager, sendFileMessage } from '../controllers/messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { apiKeyMiddleware } from '../middleware/apiKey.middleware';
import { checkSubscription } from '../middleware/subscription.middleware'; // Импортируем наш новый middleware

const router = Router();

// Роуты для n8n, защищенные API-ключом
router.post('/send-from-n8n', apiKeyMiddleware, sendMessageFromN8N);
router.post('/send-file', apiKeyMiddleware, sendFileMessage);

// Роуты для кастомеров, защищенные JWT и проверкой подписки
router.post('/send', authMiddleware, checkSubscription, sendSingleMessage);
router.post('/mass', authMiddleware, checkSubscription, sendMassMessage);
router.post('/broadcast', authMiddleware, checkSubscription, broadcastMessage);
router.get('/logs', authMiddleware, checkSubscription, getMessageLogs);
router.post('/check-bot', authMiddleware, checkSubscription, checkBotStatus);

// Роуты для админа - управление ботами
router.get('/bot-manager-stats', authMiddleware, getBotManagerStats);
router.post('/bot-manager-sync', authMiddleware, syncBotManager);

export default router; 