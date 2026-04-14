import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminAuthMiddleware } from "../middleware/adminAuth.middleware";
import { catchAsync } from "../lib/catchAsync";
import {
  getEmailBroadcastRecipientsPreview,
  postEmailBroadcast,
} from "../controllers/emailBroadcast.controller";

const router: Router = Router();

router.use(authMiddleware);
router.use(adminAuthMiddleware);

router.get("/recipients", catchAsync(getEmailBroadcastRecipientsPreview));
router.post("/", catchAsync(postEmailBroadcast));

export default router;
