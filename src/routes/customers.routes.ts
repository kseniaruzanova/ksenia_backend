import { Router } from "express";

import { authMiddleware } from '../middleware/auth.middleware';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';
import { catchAsync } from "../lib/catchAsync";
import { 
  createCustomer, 
  deleteCustomer, 
  getCustomerById, 
  getCustomers, 
  getMyProfile, 
  updateMyProfile
} from "../controllers/customers.controller";
import { createInviteLink } from "../controllers/tgChannel.controller";
import customerSettingsRoutes from "./customerSettings.routes";

const router: Router = Router();

router.use(authMiddleware);

router.get('/my-profile', catchAsync(getMyProfile));
router.put('/my-profile', catchAsync(updateMyProfile));
router.post('/tg-channel-invite-link', catchAsync(createInviteLink));

router.post('/get-by-id', adminAuthMiddleware, catchAsync(getCustomerById));
router.post('/', adminAuthMiddleware, catchAsync(createCustomer));
router.get('/', adminAuthMiddleware, catchAsync(getCustomers));
router.delete('/:id', adminAuthMiddleware, catchAsync(deleteCustomer));

router.use('/:id', customerSettingsRoutes);

export default router; 
