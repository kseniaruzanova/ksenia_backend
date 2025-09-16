import { Router } from 'express';
import { searchCities, getTimezone } from '../controllers/geocoding.controller';

const router = Router();

// GET /api/geocoding/search?q=москва&limit=10
router.get('/search', searchCities);

// GET /api/geocoding/timezone?lat=55.7558&lon=37.6173
router.get('/timezone', getTimezone);

export default router;
