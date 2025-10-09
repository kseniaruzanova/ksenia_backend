import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getFinancialCast, getFinancialCastAsPdf } from "../../controllers/products/financialCast.controller";

const router: Router = Router();

// POST /api/financialCast
router.post("/", validate(arcanSchema), catchAsync(getFinancialCast));

// POST /api/financialCast/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getFinancialCastAsPdf));

export default router;
