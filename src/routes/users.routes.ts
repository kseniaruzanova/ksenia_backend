import { Router } from 'express';
import { getUsers, getUserById } from '../controllers/users.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, getUsers);
router.get('/by-chat-id/:id', authMiddleware, getUserById);

export default router; 