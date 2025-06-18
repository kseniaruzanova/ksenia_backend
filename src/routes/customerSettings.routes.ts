import { Router } from 'express';
import { getCustomerSettings, updateCustomerSettings } from '../controllers/customerSettings.controller';

const router = Router({ mergeParams: true });

router.get('/settings', getCustomerSettings);
router.put('/settings', updateCustomerSettings);

export default router; 