import { Router } from 'express';
import { sendSingleMessage, sendMassMessage, getMessageLogs, broadcastMessage } from '../controllers/messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/send', authMiddleware, sendSingleMessage);
router.post('/mass', authMiddleware, sendMassMessage);
router.post('/broadcast', authMiddleware, broadcastMessage);
router.get('/logs', authMiddleware, getMessageLogs);

export default router; 