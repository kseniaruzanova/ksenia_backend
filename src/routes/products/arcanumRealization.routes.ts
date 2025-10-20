import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getArcanumRealizationAsPdf } from "../../controllers/products/arcanumRealization.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router: Router = Router();

// Все роуты требуют аутентификации
router.use(authMiddleware);

// POST /api/arcanumRealization/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getArcanumRealizationAsPdf));

export default router;
