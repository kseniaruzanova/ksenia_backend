import { Router } from "express";
import { catchAsync } from "../lib/catchAsync";
import { getTimezone, searchCities } from "../controllers/geocoding.controller";

const router: Router = Router();

// GET /api/geocoding/search?q=москва&limit=10
router.get('/search', catchAsync(searchCities));

// GET /api/geocoding/timezone?lat=55.7558&lon=37.6173
router.get('/timezone', catchAsync(getTimezone));

export default router;
