import { Router } from "express";
import { getFinancialCast, getFinancialCastAsPdf } from "../controllers/financialCastController.controller";
import { validate } from "../middleware/validate";
import { forecastSchema } from "../lib/validators/forecastValidators";
import { catchAsync } from "../lib/catchAsync";

const router = Router();

// POST /api/financialCast - получить прогноз
router.post("/", validate(forecastSchema), catchAsync(getFinancialCast));
// POST /api/financialCast/pdf - получить прогноз в формате PDF
router.post('/pdf', validate(forecastSchema), catchAsync(getFinancialCastAsPdf));

export default router;
