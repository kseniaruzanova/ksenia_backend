import { Router } from 'express';
import { uploadImages as uploadImagesController, uploadAudio as uploadAudioController } from '../controllers/upload.controller';
import { uploadImages, uploadAudio } from '../middleware/upload.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { catchAsync } from '../lib/catchAsync';

const router = Router();

// Все роуты требуют аутентификацию
router.use(authMiddleware);

// POST /api/upload/images - загрузить изображения
router.post('/images', uploadImages, catchAsync(uploadImagesController));

// POST /api/upload/audio - загрузить аудио
router.post('/audio', uploadAudio, catchAsync(uploadAudioController));

export default router;

