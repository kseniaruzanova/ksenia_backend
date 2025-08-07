import { Router } from 'express';
import { createPayment, getPaymentsPaginated, getPaymentsByUsernamePaginated } from '../controllers/payment.controller';
import { apiKeyMiddleware } from '../middleware/apiKey.middleware';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Создать платеж (защищено API-ключом)
router.post('/create', apiKeyMiddleware, createPayment);

// Получить все платежи с пагинацией (только для админа)
router.get('/', authMiddleware, getPaymentsPaginated);

// Получить платежи по username с пагинацией (только для админа)
router.get('/payments/by-username/:username', authMiddleware, getPaymentsByUsernamePaginated);

export default router;
