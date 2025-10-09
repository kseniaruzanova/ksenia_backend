import { Router } from "express";

import { catchAsync } from "../lib/catchAsync";
import { authMiddleware } from "../middleware/auth.middleware";
import { getPaymentsByUsernamePaginated, getPaymentsPaginated } from "../controllers/payment.controller";

const router: Router = Router();

router.get('/', authMiddleware, catchAsync(getPaymentsPaginated));

router.get('/payments/by-username/:username', authMiddleware, catchAsync(getPaymentsByUsernamePaginated));

export default router;
