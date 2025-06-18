import { Router } from 'express';
import { login, verifyToken, refreshToken } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.get('/verify', verifyToken);
router.post('/refresh', refreshToken);

export default router; 