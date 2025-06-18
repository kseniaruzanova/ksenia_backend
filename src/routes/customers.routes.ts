import { Router } from 'express';
import { createCustomer, getCustomers, deleteCustomer } from '../controllers/customers.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import customerSettingsRoutes from './customerSettings.routes';

const router = Router();

// Все роуты для управления клиентами защищены
router.use(authMiddleware);

router.post('/', createCustomer);
router.get('/', getCustomers);
router.delete('/:id', deleteCustomer);

// Вложенные роуты для настроек кастомера
router.use('/:id', customerSettingsRoutes);

export default router; 