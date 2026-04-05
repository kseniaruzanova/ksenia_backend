import { Router } from 'express';

import { catchAsync } from "../lib/catchAsync";
import { authMiddleware } from "../middleware/auth.middleware";
import { 
  getLinkProdamusBasic, 
  getLinkProdamusPro,
  getLinkProdamusTgMax,
  handleProdamusWebhook
} from "../controllers/prodamus.controller";

const router: Router = Router();

// Универсальный webhook для всех типов платежей
router.post('/webhook', catchAsync(handleProdamusWebhook));

// Старые адреса оставлены для обратной совместимости
router.post('/webhook/subscription', catchAsync(handleProdamusWebhook));
router.post('/webhook/tarot-payment', catchAsync(handleProdamusWebhook));

// Защищенные роуты (требуют авторизации)
router.use(authMiddleware);

router.get('/create/link/basic', catchAsync(getLinkProdamusBasic));

router.get('/create/link/pro', catchAsync(getLinkProdamusPro));

router.get('/create/link/tg_max', catchAsync(getLinkProdamusTgMax));

export default router;
