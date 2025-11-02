import { Router } from 'express';
import multer from 'multer';
import {
  getUserReels,
  createReel,
  getReel,
  updateReel,
  deleteReel,
  generateScenario,
  generateVideoBlocks,
  updateVideoBlocks,
  generateFinalVideo,
  getVideoGenerationProgress,
  regenerateFinalVideo,
  regenerateImage,
  getQueueStats,
  getThreadPoolStats,
  cancelGenerationTask,
  generateBlockImages,
  updateBlockPrompts,
  updateBlock,
  uploadBlockAudio,
} from '../controllers/reels.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { catchAsync } from '../lib/catchAsync';

const router = Router();
const storage = multer.memoryStorage();

// Фильтр для аудио файлов
const audioFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid audio file format. Allowed formats: MP3, WAV, M4A, OGG, WEBM'));
  }
};

const upload = multer({ 
  storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  }
});

// Все роуты требуют аутентификацию
router.use(authMiddleware);

// GET /api/reels - получить все рилсы пользователя
router.get('/', catchAsync(getUserReels));

// POST /api/reels - создать новый рилс
router.post('/', catchAsync(createReel));

// GET /api/reels/:id - получить конкретный рилс
router.get('/:id', catchAsync(getReel));

// POST /api/reels/:id/generate-scenario - сгенерировать сценарий для рилса
router.post('/:id/generate-scenario', catchAsync(generateScenario));

// POST /api/reels/:id/generate-video-blocks - сгенерировать блоки для видео
router.post('/:id/generate-video-blocks', catchAsync(generateVideoBlocks));

// PUT /api/reels/:id/video-blocks - обновить блоки видео
router.put('/:id/video-blocks', catchAsync(updateVideoBlocks));

// POST /api/reels/:id/generate-final-video - сгенерировать финальное видео
router.post('/:id/generate-final-video', catchAsync(generateFinalVideo));

// POST /api/reels/:id/regenerate-final-video - перегенерировать финальное видео
router.post('/:id/regenerate-final-video', catchAsync(regenerateFinalVideo));

// GET /api/reels/:id/generation-progress - получить прогресс генерации видео
router.get('/:id/generation-progress', catchAsync(getVideoGenerationProgress));

// POST /api/reels/regenerate-image - перегенерировать изображение по промпту
router.post('/regenerate-image', catchAsync(regenerateImage));

// PUT /api/reels/:id - обновить рилс
router.put('/:id', catchAsync(updateReel));

// DELETE /api/reels/:id - удалить рилс
router.delete('/:id', catchAsync(deleteReel));

// GET /api/reels/stats/queue - получить статистику очередей
router.get('/stats/queue', catchAsync(getQueueStats));

// GET /api/reels/stats/thread-pool - получить статистику пула потоков
router.get('/stats/thread-pool', catchAsync(getThreadPoolStats));

// DELETE /api/reels/tasks/:taskId - отменить задачу генерации
router.delete('/tasks/:taskId', catchAsync(cancelGenerationTask));

// POST /api/reels/:id/blocks/:blockIndex/generate-images - сгенерировать изображения для блока
router.post('/:id/blocks/:blockIndex/generate-images', catchAsync(generateBlockImages));

// PUT /api/reels/:id/blocks/:blockIndex/prompts - обновить промпты блока
router.put('/:id/blocks/:blockIndex/prompts', catchAsync(updateBlockPrompts));

// PUT /api/reels/:id/blocks/:blockIndex - обновить весь блок
router.put('/:id/blocks/:blockIndex', catchAsync(updateBlock));

// POST /api/reels/:id/blocks/:blockIndex/upload-audio - загрузить аудио для блока
router.post(
  '/:id/blocks/:blockIndex/upload-audio',
  (req, res, next) => {
    upload.single('audio')(req, res, (err: any) => {
      if (err) {
        console.error('❌ Multer error:', err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Audio file is too large. Maximum size is 20MB' });
          }
          return res.status(400).json({ error: `Multer error: ${err.message}` });
        }
        return res.status(500).json({ error: `Upload error: ${err.message}` });
      }
      next();
    });
  },
  catchAsync(uploadBlockAudio)
);

export default router;

