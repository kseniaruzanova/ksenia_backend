import { Router } from 'express';
import { sendSingleMessage, sendMassMessage, getMessageLogs } from '../controllers/messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/single', authMiddleware, sendSingleMessage);
router.post('/mass', authMiddleware, sendMassMessage);
router.get('/logs', authMiddleware, getMessageLogs);

export default router; 