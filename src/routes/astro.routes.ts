import { Router } from 'express';

import { catchAsync } from '../lib/catchAsync';
import { natalChartController } from '../controllers/natalChart.controller';
import { planetSignController } from '../controllers/planetSign.controller';
import { horoscopeController } from '../controllers/horoscope.controller';

const router = Router();

router.post('/natal', catchAsync(natalChartController.calculateNatalChart));
router.post('/planet-sign', catchAsync(planetSignController.getPlanetSign));
router.get('/horoscope/:planet/:sign', catchAsync(horoscopeController.getHoroscope));

export default router;
