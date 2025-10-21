import { Router } from "express";
import {
  getPlaylists,
  getPlaylistById,
  getPlaylistVideos,
  createPlaylist,
  updatePlaylist,
  deletePlaylist
} from "../controllers/playlist.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminAuthMiddleware } from "../middleware/adminAuth.middleware";

const router: Router = Router();

// Публичные маршруты (для просмотра)
router.get('/', getPlaylists);
router.get('/:id', getPlaylistById);
router.get('/:id/videos', getPlaylistVideos);

// Защищенные маршруты (только для администраторов)
router.post('/', authMiddleware, adminAuthMiddleware, createPlaylist);
router.put('/:id', authMiddleware, adminAuthMiddleware, updatePlaylist);
router.delete('/:id', authMiddleware, adminAuthMiddleware, deletePlaylist);

export default router;

