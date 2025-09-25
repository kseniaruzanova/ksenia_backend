import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    getDailyMessagingConfig,
    updateDailyMessagingConfig,
    startDailyMessagingScheduler,
    stopDailyMessagingScheduler,
    sendDailyMessagesNow,
    testSingleUser,
    getUsersByCustomer,
    getSentMessagesLogs,
    getDailyMessagingStats
} from '../controllers/dailyMessaging.controller';

const router = Router();

// Все маршруты требуют аутентификации
// router.use(authMiddleware);

// Получить конфигурацию
router.get('/config', getDailyMessagingConfig);

// Обновить конфигурацию
router.put('/config', updateDailyMessagingConfig);

// Запустить планировщик
router.post('/scheduler/start', startDailyMessagingScheduler);

// Остановить планировщик
router.post('/scheduler/stop', stopDailyMessagingScheduler);

// Принудительно отправить сообщения сейчас
router.post('/send-now', sendDailyMessagesNow);

// Тестировать на одном пользователе
router.post('/test-single', testSingleUser);

// Получить пользователей по кастомеру
router.get('/users-by-customer', getUsersByCustomer);

// Получить логи отправленных сообщений
router.get('/sent-logs', getSentMessagesLogs);

// Получить статистику
router.get('/stats', getDailyMessagingStats);

export default router;
