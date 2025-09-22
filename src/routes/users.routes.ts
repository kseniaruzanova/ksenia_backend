import { Router } from 'express';
import { getUsers, getUserById, upsertUser, checkUserExists, debugData, fixIndexes, updateUserFields, getAllUsers, checkUserData } from '../controllers/users.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { apiKeyMiddleware } from '../middleware/apiKey.middleware';

const router = Router();

// Маршруты для n8n, защищенные API-ключом
router.post('/upsert', apiKeyMiddleware, upsertUser);
router.post('/check', apiKeyMiddleware, checkUserExists);
router.post('/check-data', apiKeyMiddleware, checkUserData);
router.put('/update-fields', apiKeyMiddleware, updateUserFields);

// Маршруты для клиентов, защищенные JWT
router.get('/', authMiddleware, getUsers);
router.get('/all', authMiddleware, getAllUsers);
router.get('/debug', authMiddleware, debugData);
router.post('/fix-indexes', authMiddleware, fixIndexes);
router.get('/by-chat-id/:id', authMiddleware, getUserById);

export default router; 