import { Router } from "express";
import { authMiddleware } from '../middleware/auth.middleware';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';
import { catchAsync } from "../lib/catchAsync";
import { getAISettings, updateAISettings, testProxyConnection } from "../controllers/aiSettings.controller";

const router: Router = Router();

router.use(authMiddleware);
router.use(adminAuthMiddleware);

router.get('/', catchAsync(getAISettings));
router.put('/', catchAsync(updateAISettings));
router.post('/test-proxy', catchAsync(testProxyConnection));

export default router;

