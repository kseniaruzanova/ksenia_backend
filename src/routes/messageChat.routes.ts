import express from 'express';
import { getChatMessages } from '../controllers/messageController.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { catchAsync } from '../lib/catchAsync';

const router = express.Router();

router.use(authMiddleware);

// Получение сообщений чата (POST)
router.post('/getChat', catchAsync(getChatMessages));

export default router;