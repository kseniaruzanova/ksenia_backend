import { Router } from 'express';

import { catchAsync } from '../lib/catchAsync';
import { natalChartController } from '../controllers/natalChart.controller';
import { planetSignController } from '../controllers/planetSign.controller';

const router = Router();

router.post('/natal', catchAsync(natalChartController.calculateNatalChart));
router.post('/planet-sign', catchAsync(planetSignController.getPlanetSign));

export default router;
