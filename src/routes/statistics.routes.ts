import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getGeneralStats } from '../controllers/statistics.controller';

const router = Router();

router.get('/general', authMiddleware, getGeneralStats);

export default router;
