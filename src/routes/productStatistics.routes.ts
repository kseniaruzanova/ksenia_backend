import express from 'express';
import { catchAsync } from '../lib/catchAsync';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';
import { 
  getProductStatistics, 
  getProductDetailedStatistics, 
  getProductStatisticsByPeriod 
} from '../controllers/productStatistics.controller';

const router = express.Router();

// Все маршруты требуют админских прав
router.use(authMiddleware);
router.use(adminAuthMiddleware);

// Получить общую статистику по всем продуктам
router.get('/', catchAsync(getProductStatistics));

// Получить статистику по периоду
router.get('/period', catchAsync(getProductStatisticsByPeriod));

// Получить детальную статистику по конкретному продукту
router.get('/:productType', catchAsync(getProductDetailedStatistics));

export default router;

