// routes/videos.ts
import express from 'express';
import multer from 'multer';
import {
  getVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  getFile,
  getThumbnail
} from '../controllers/video.controller';

const router = express.Router();

// Настройка multer для памяти (чтобы потом сохранять в GridFS)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Получить список всех видео
router.get('/', getVideos);

// Создать новое видео (файл видео + обложка)
router.post(
  '/',
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  createVideo
);

// Обновить видео по ID (файл видео + обложка)
router.put(
  '/:id',
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  updateVideo
);

// Удалить видео по ID
router.delete('/:id', deleteVideo);

// Получить файл видео по ID (GridFS)
router.get('/file/:id', getFile);

// Получить thumbnail по ID (GridFS)
router.get('/thumbnail/:id', getThumbnail);

export default router;
