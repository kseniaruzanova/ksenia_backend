import { Router } from 'express';
import { 
  getAllContent, 
  getContentById, 
  getActiveContent,
  createContent, 
  updateContent, 
  deleteContent,
  toggleContentActive
} from '../controllers/content.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';
import { validate } from '../middleware/validate';
import { 
  createContentSchema, 
  updateContentSchema, 
  getContentSchema, 
  deleteContentSchema 
} from '../lib/validators/contentValidators';

const router = Router();

// Публичные роуты (без аутентификации)
router.get('/active', getActiveContent);

// Защищенные роуты для супер администратора
router.use(authMiddleware, adminAuthMiddleware);

// CRUD операции
router.get('/', getAllContent);
router.get('/:id', validate(getContentSchema), getContentById);
router.post('/', validate(createContentSchema), createContent);
router.put('/:id', validate(updateContentSchema), updateContent);
router.delete('/:id', validate(deleteContentSchema), deleteContent);

// Дополнительные операции
router.patch('/:id/toggle', validate(getContentSchema), toggleContentActive);

export default router;