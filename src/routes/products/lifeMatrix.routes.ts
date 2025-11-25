import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getLifeMatrix, getLifeMatrixAsPdf } from "../../controllers/products/lifeMatrix.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router: Router = Router();

// Все роуты требуют аутентификации
router.use(authMiddleware);

// POST /api/lifeMatrix
router.post("/", validate(arcanSchema), catchAsync(getLifeMatrix));

// POST /api/lifeMatrix/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getLifeMatrixAsPdf));

export default router;

