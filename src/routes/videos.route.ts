import express from 'express';
import multer from 'multer';
import {
  getVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  getFile,
  getThumbnail,
  uploadProgressMiddleware
} from '../controllers/video.controller';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Добавляем middleware для отслеживания прогресса
router.post(
  '/',
  uploadProgressMiddleware,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  createVideo
);

router.put(
  '/:id',
  uploadProgressMiddleware,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  updateVideo
);

// Остальные маршруты без изменений
router.get('/', getVideos);
router.delete('/:id', deleteVideo);
router.get('/file/:id', getFile);
router.get('/thumbnail/:id', getThumbnail);

export default router;
