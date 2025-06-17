import { Router } from 'express';
import { createCustomer, getCustomers, deleteCustomer } from '../controllers/customers.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Все роуты для управления клиентами защищены
router.use(authMiddleware);

router.post('/', createCustomer);
router.get('/', getCustomers);
router.delete('/:id', deleteCustomer);

export default router; 