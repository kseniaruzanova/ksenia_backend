import { Router } from 'express';
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
} from '../controllers/reels.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { catchAsync } from '../lib/catchAsync';

const router = Router();

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

// PUT /api/reels/:id - обновить рилс
router.put('/:id', catchAsync(updateReel));

// DELETE /api/reels/:id - удалить рилс
router.delete('/:id', catchAsync(deleteReel));

export default router;

