import { Router } from "express";

import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getForecast, getForecastAsPdf } from "../../controllers/products/forecast.controller";

const router: Router = Router();

// POST /api/forecast
router.post("/", validate(arcanSchema), catchAsync(getForecast));

// POST /api/forecast/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getForecastAsPdf));

export default router;
