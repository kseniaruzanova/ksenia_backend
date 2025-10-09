import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getAwakeningCodes, getAwakeningCodesAsPdf } from "../../controllers/products/awakeningCodes.controller";

const router: Router = Router();

// POST /api/awakeningCodes
router.post("/", validate(arcanSchema), catchAsync(getAwakeningCodes));

// POST /api/awakeningCodes/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getAwakeningCodesAsPdf));

export default router;
