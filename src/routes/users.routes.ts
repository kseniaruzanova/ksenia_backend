import { Router } from 'express';
import { getUsers, getUserById, upsertUser, checkUserExists } from '../controllers/users.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { apiKeyMiddleware } from '../middleware/apiKey.middleware';

const router = Router();

// Маршруты для n8n, защищенные API-ключом
router.post('/upsert', apiKeyMiddleware, upsertUser);
router.post('/check', apiKeyMiddleware, checkUserExists);

// Маршруты для клиентов, защищенные JWT
router.get('/', authMiddleware, getUsers);
router.get('/by-chat-id/:id', authMiddleware, getUserById);

export default router; 