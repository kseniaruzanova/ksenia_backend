import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getArchetypeShadowAsPdf } from "../../controllers/products/archetypeShadow.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router: Router = Router();

// Все роуты требуют аутентификации
router.use(authMiddleware);

// POST /api/archetypeShadow/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getArchetypeShadowAsPdf));

export default router;
