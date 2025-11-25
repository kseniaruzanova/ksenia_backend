import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getStagnationCycleAsPdf } from "../../controllers/products/stagnationCycle.controller";

const router: Router = Router();

router.use(authMiddleware);

router.post('/pdf', validate(arcanSchema), catchAsync(getStagnationCycleAsPdf));

export default router;

