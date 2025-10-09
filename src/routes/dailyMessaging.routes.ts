import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
    getDailyMessagingConfig,
    updateDailyMessagingConfig,
    startDailyMessagingScheduler,
    stopDailyMessagingScheduler,
    sendDailyMessagesNow,
    getUsersForDailyMessaging,
    testSingleDailyUser,
    getDailyMessagingStats,
    getDailyMessagingHistory
} from "../controllers/dailyMessaging.controller";

const router: Router = Router();

router.use(authMiddleware);

router.get('/config', getDailyMessagingConfig);
router.put('/config', updateDailyMessagingConfig);

router.post('/scheduler/start', startDailyMessagingScheduler);
router.post('/scheduler/stop', stopDailyMessagingScheduler);

router.post('/send-now', sendDailyMessagesNow);

router.get('/users/birthday-today', getUsersForDailyMessaging);
router.post('/test-single-user', testSingleDailyUser);

router.get('/stats', getDailyMessagingStats);
router.get('/history', getDailyMessagingHistory);

export default router;
