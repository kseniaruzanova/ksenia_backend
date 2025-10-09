import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getGeneralStats } from '../controllers/statistics.controller';
import { catchAsync } from '../lib/catchAsync';

const router: Router = Router();

router.get('/general', authMiddleware, catchAsync(getGeneralStats));

export default router;
