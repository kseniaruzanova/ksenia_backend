import { Router } from 'express';
import { searchCities } from '../controllers/geocoding.controller';

const router = Router();

// GET /api/geocoding/search?q=москва&limit=10
router.get('/search', searchCities);

export default router;
