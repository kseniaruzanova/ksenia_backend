import { Router } from 'express';
import { 
    getIncomingMessagesStats, 
    getRecentIncomingMessages, 
    getUserDetails, 
    getAllIncomingMessagesStats 
} from '../controllers/incomingMessages.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Все роуты требуют авторизации
router.use(authMiddleware);

// Роуты для кастомеров
router.get('/stats', getIncomingMessagesStats);                    // Статистика входящих сообщений
router.get('/recent', getRecentIncomingMessages);                 // Последние входящие сообщения
router.get('/user/:chat_id', getUserDetails);                     // Детали пользователя по chat_id

// Админские роуты
router.get('/admin/all-stats', getAllIncomingMessagesStats);      // Статистика по всем ботам

export default router; 