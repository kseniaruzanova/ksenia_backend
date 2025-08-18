import { Router } from "express";
import { validate } from "../middleware/validate";
import { forecastSchema } from "../lib/validators/forecastValidators";
import { catchAsync } from "../lib/catchAsync";
import { getAwakeningCodes, getAwakeningCodesAsPdf } from "../controllers/awakeningCodes.controller";
// import { protect } from '../middleware/authMiddleware'; // Раскомментируйте, если прогноз доступен только авторизованным пользователям

const router = Router();

// Если прогноз должен быть доступен только авторизованным, используйте:
// router.use(protect);

// POST /api/awakeningCodes - получить прогноз
router.post("/", validate(forecastSchema), catchAsync(getAwakeningCodes));
// POST /api/awakeningCodes/pdf - получить прогноз в формате PDF
router.post('/pdf', validate(forecastSchema), catchAsync(getAwakeningCodesAsPdf));
export default router;
