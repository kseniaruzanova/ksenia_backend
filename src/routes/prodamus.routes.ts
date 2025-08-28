import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { catchAsync } from '../lib/catchAsync';
import { getLinkProdamusBasic, getLinkProdamusPro, updateProdamus } from '../controllers/prodamus.controller';
import { apiKeyMiddleware } from '../middleware/apiKey.middleware';

const router = express.Router();

router.post('/update', apiKeyMiddleware, catchAsync(updateProdamus));

router.use(authMiddleware);

router.get('/create/link/basic', catchAsync(getLinkProdamusBasic));

router.get('/create/link/pro', catchAsync(getLinkProdamusPro));



export default router;
