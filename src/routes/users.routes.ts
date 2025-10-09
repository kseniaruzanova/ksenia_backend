import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getAllUsers,
  getUserByChatId,
  getUsers,
  upsertUser,
  updateUserFields,
  deleteUser
} from '../controllers/users.controller';

const router = Router();

// Все роуты защищены middleware авторизации
router.use(authMiddleware);

// GET /api/users/all - получить всех пользователей (без пагинации)
router.get('/all', getAllUsers);

// GET /api/users/by-chat-id/:chatId - получить пользователя по chat_id
router.get('/by-chat-id/:chatId', getUserByChatId);

// GET /api/users - получить пользователей с пагинацией
router.get('/', getUsers);

// POST /api/users/upsert - создать или обновить пользователя
router.post('/upsert', upsertUser);

// PATCH /api/users/:chatId - обновить поля пользователя
router.patch('/:chatId', updateUserFields);

// DELETE /api/users/:chatId - удалить пользователя
router.delete('/:chatId', deleteUser);

export default router;

