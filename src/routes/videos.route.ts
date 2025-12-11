import { Router } from "express";
import multer from "multer";
import {
  getVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  getFile,
  getThumbnail,
  uploadProgressMiddleware
} from "../controllers/video.controller";

const router: Router = Router();

const storage: multer.StorageEngine = multer.memoryStorage();
const upload: multer.Multer = multer({ 
  limits: {
    fileSize: 5000 * 1024 * 1024,
    files: 5
  },
  storage 
});

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

router.get('/', getVideos);
router.delete('/:id', deleteVideo);
router.get('/file/:id', getFile);
router.get('/thumbnail/:id', getThumbnail);

export default router;
