import { Router } from 'express';

import { catchAsync } from "../lib/catchAsync";
import { authMiddleware } from "../middleware/auth.middleware";
import { 
  getLinkProdamusBasic, 
  getLinkProdamusPro,
  handleProdamusWebhook
} from "../controllers/prodamus.controller";

const router: Router = Router();

// Универсальный webhook для всех типов платежей
router.post('/webhook/tarot-payment', catchAsync(handleProdamusWebhook));

// Защищенные роуты (требуют авторизации)
router.use(authMiddleware);

router.get('/create/link/basic', catchAsync(getLinkProdamusBasic));

router.get('/create/link/pro', catchAsync(getLinkProdamusPro));

export default router;
