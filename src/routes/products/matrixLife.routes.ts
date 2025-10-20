import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getMatrixLife, getMatrixLifeAsPdf } from "../../controllers/products/matrixLife.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router: Router = Router();

// Все роуты требуют аутентификации
router.use(authMiddleware);

// POST /api/matrixLife
router.post("/", validate(arcanSchema), catchAsync(getMatrixLife));

// POST /api/matrixLife/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getMatrixLifeAsPdf));

export default router;

