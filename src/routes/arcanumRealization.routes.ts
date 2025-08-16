import { Router } from "express";
import { validate } from "../middleware/validate";
import { forecastSchema } from "../lib/validators/forecastValidators";
import { catchAsync } from "../lib/catchAsync";
import { getArcanumRealizationAsPdf } from "../controllers/arcanumRealization.controller";
// import { protect } from '../middleware/authMiddleware'; // Раскомментируйте, если прогноз доступен только авторизованным пользователям

const router = Router();

// Если прогноз должен быть доступен только авторизованным, используйте:
// router.use(protect);

// POST /api/arcanumRealization/pdf - получить прогноз в формате PDF
router.post('/pdf', validate(forecastSchema), catchAsync(getArcanumRealizationAsPdf));
export default router;
