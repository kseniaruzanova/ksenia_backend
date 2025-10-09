import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getArcanumRealizationAsPdf } from "../../controllers/products/arcanumRealization.controller";

const router: Router = Router();

// POST /api/arcanumRealization/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getArcanumRealizationAsPdf));

export default router;
