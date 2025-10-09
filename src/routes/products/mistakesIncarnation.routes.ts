import { Router } from "express";
import { validate } from "../../lib/validate";
import { catchAsync } from "../../lib/catchAsync";
import { arcanSchema } from "../../lib/validators/forecastValidators";
import { getMistakesIncarnation, getMistakesIncarnationAsPdf } from "../../controllers/products/mistakesIncarnation.controller";

const router: Router = Router();

// POST /api/mistakesIncarnation
router.post("/", validate(arcanSchema), catchAsync(getMistakesIncarnation));

// POST /api/mistakesIncarnation/pdf
router.post('/pdf', validate(arcanSchema), catchAsync(getMistakesIncarnationAsPdf));

export default router;
