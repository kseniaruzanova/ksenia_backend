import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getKarmicTail, getKarmicTailAsPdf } from "../../controllers/products/karmicTail.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router: Router = Router();

// Все роуты требуют аутентификации
router.use(authMiddleware);

// POST /api/karmicTail
router.post("/", validate(arcanSchema), catchAsync(getKarmicTail));

// POST /api/karmicTail/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getKarmicTailAsPdf));

export default router;

