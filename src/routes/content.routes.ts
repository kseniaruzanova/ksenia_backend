import { Router } from "express";
import { 
  getAllContent, 
  getContentById, 
  getActiveContent,
  createContent, 
  updateContent, 
  deleteContent,
  toggleContentActive
} from "../controllers/content.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminAuthMiddleware } from "../middleware/adminAuth.middleware";
import { 
  createContentSchema, 
  updateContentSchema, 
  getContentSchema,
  getActiveContentSchema,
  deleteContentSchema 
} from "../lib/validators/contentValidators";

import { validate } from "../lib/validate";
import { catchAsync } from "../lib/catchAsync";

const router: Router = Router();

router.get('/active', validate(getActiveContentSchema), catchAsync(getActiveContent));

router.use(authMiddleware, adminAuthMiddleware);

router.get('/', getAllContent);
router.get('/:id', validate(getContentSchema), catchAsync(getContentById));
router.post('/', validate(createContentSchema), catchAsync(createContent));
router.put('/:id', validate(updateContentSchema), catchAsync(updateContent));
router.delete('/:id', validate(deleteContentSchema), catchAsync(deleteContent));

router.patch('/:id/toggle', validate(getContentSchema), catchAsync(toggleContentActive));

export default router;
