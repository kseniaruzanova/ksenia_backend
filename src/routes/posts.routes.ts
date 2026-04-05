import { Router } from "express";
import multer from "multer";
import { createPost, deletePost, getPosts, updatePost } from "../controllers/posts.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminAuthMiddleware } from "../middleware/adminAuth.middleware";

const router: Router = Router();

const storage: multer.StorageEngine = multer.memoryStorage();
const upload: multer.Multer = multer({
  storage,
  limits: {
    fileSize: 250 * 1024 * 1024,
    files: 20
  }
});

router.get("/", getPosts);
router.post("/", authMiddleware, adminAuthMiddleware, upload.array("attachments", 20), createPost);
router.put("/:id", authMiddleware, adminAuthMiddleware, upload.array("attachments", 20), updatePost);
router.delete("/:id", authMiddleware, adminAuthMiddleware, deletePost);

export default router;
