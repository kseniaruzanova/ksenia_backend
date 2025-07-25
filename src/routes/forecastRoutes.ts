import { Router } from "express";
import { getForecast, getForecastAsPdf } from "../controllers/forecastController";
import { validate } from "../middleware/validate";
import { forecastSchema } from "../lib/validators/forecastValidators";
import { catchAsync } from "../lib/catchAsync";
// import { protect } from '../middleware/authMiddleware'; // Раскомментируйте, если прогноз доступен только авторизованным пользователям

const router = Router();

// Если прогноз должен быть доступен только авторизованным, используйте:
// router.use(protect);

// POST /api/forecast - получить прогноз
router.post("/", validate(forecastSchema), catchAsync(getForecast));

// POST /api/forecast/pdf - получить прогноз в формате PDF
router.post('/pdf', validate(forecastSchema), catchAsync(getForecastAsPdf));
export default router;
