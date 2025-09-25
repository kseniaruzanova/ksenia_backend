import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    getBirthdayMessagingConfig,
    updateBirthdayMessagingConfig,
    startBirthdayMessagingScheduler,
    stopBirthdayMessagingScheduler,
    sendBirthdayMessagesNow,
    getUsersWithBirthdayToday,
    testSingleBirthdayUser,
    getBirthdayMessagingStats
} from '../controllers/birthdayMessaging.controller';

const router = Router();

// Все маршруты требуют аутентификации
// router.use(authMiddleware);

// Конфигурация
router.get('/config', getBirthdayMessagingConfig);
router.put('/config', updateBirthdayMessagingConfig);

// Управление планировщиком
router.post('/scheduler/start', startBirthdayMessagingScheduler);
router.post('/scheduler/stop', stopBirthdayMessagingScheduler);

// Отправка сообщений
router.post('/send-now', sendBirthdayMessagesNow);

// Пользователи
router.get('/users/birthday-today', getUsersWithBirthdayToday);
router.post('/test-single-user', testSingleBirthdayUser);

// Статистика
router.get('/stats', getBirthdayMessagingStats);

export default router;
