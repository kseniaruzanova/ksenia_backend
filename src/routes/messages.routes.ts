import { Router } from 'express';
import { sendSingleMessage, sendMassMessage, getMessageLogs, broadcastMessage, checkBotStatus, sendMessageFromN8N } from '../controllers/messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { apiKeyMiddleware } from '../middleware/apiKey.middleware';

const router = Router();

// Роуты для n8n, защищенные API-ключом
router.post('/send-from-n8n', apiKeyMiddleware, sendMessageFromN8N);

// Роуты для кастомеров, защищенные JWT
router.post('/send', authMiddleware, sendSingleMessage);
router.post('/mass', authMiddleware, sendMassMessage);
router.post('/broadcast', authMiddleware, broadcastMessage);
router.get('/logs', authMiddleware, getMessageLogs);
router.post('/check-bot', authMiddleware, checkBotStatus);

export default router; 