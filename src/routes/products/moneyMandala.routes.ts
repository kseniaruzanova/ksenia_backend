import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getMoneyMandala, getMoneyMandalaAsPdf } from "../../controllers/products/moneyMandala.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router: Router = Router();

// Все роуты требуют аутентификации
router.use(authMiddleware);

// POST /api/moneyMandala
router.post("/", validate(arcanSchema), catchAsync(getMoneyMandala));

// POST /api/moneyMandala/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getMoneyMandalaAsPdf));

export default router;

