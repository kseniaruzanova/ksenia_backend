import { Router } from 'express';
import { createCustomer, getCustomers, deleteCustomer, getMyProfile, updateMyProfile, getCustomerById } from '../controllers/customers.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { apiKeyMiddleware } from '../middleware/apiKey.middleware';
import customerSettingsRoutes from './customerSettings.routes';

const router = Router();

// Роуты для n8n, защищенные API-ключом
router.post('/get-by-id', apiKeyMiddleware, getCustomerById);

// Роуты защищенные JWT
router.use(authMiddleware);

// Роуты для кастомеров (собственные данные)
router.get('/my-profile', getMyProfile);      // Получить свой профиль
router.put('/my-profile', updateMyProfile);   // Обновить свой профиль

// Админские роуты
router.post('/', createCustomer);
router.get('/', getCustomers);
router.delete('/:id', deleteCustomer);

// Вложенные роуты для настроек кастомера
router.use('/:id', customerSettingsRoutes);

export default router; 