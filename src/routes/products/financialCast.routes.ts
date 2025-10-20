import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getFinancialCast, getFinancialCastAsPdf } from "../../controllers/products/financialCast.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router: Router = Router();

// Все роуты требуют аутентификации
router.use(authMiddleware);

// POST /api/financialCast
router.post("/", validate(arcanSchema), catchAsync(getFinancialCast));

// POST /api/financialCast/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getFinancialCastAsPdf));

export default router;
