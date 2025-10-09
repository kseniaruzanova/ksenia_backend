import { Router } from 'express';

import { catchAsync } from "../lib/catchAsync";
import { authMiddleware } from "../middleware/auth.middleware";
import { 
  getLinkProdamusBasic, 
  getLinkProdamusPro,
  updateProdamusSubscription,
  handleTarotPaymentWebhook
} from "../controllers/prodamus.controller";

const router: Router = Router();

// Публичные роуты (для webhooks от Prodamus)
router.post('/webhook/subscription', catchAsync(updateProdamusSubscription));
router.post('/webhook/tarot-payment', catchAsync(handleTarotPaymentWebhook));

// Защищенные роуты (требуют авторизации)
router.use(authMiddleware);

router.get('/create/link/basic', catchAsync(getLinkProdamusBasic));

router.get('/create/link/pro', catchAsync(getLinkProdamusPro));

export default router;
