import { Request, Response } from 'express';
import Customer from '../models/customer.model';
import { randomBytes } from 'crypto';
import { AuthRequest } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

// Функция для генерации случайного пароля
const generatePassword = (length = 8) => {
    return randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, botToken } = req.body;
        if (!username || !botToken) {
            res.status(400).json({ message: 'Username and botToken are required' });
            return;
        }

        const existingCustomer = await Customer.findOne({ username });
        if (existingCustomer) {
            res.status(409).json({ message: 'Customer with this username already exists' });
            return;
        }

        const password = generatePassword();
        const newCustomer = new Customer({
            username,
            botToken,
            password,
        });

        await newCustomer.save();

        // Возвращаем данные клиента, включая сгенерированный пароль
        res.status(201).json({
            message: 'Customer created successfully',
            customer: {
                _id: newCustomer._id,
                username: newCustomer.username,
                botToken: newCustomer.botToken,
                password: password, // Важно, чтобы администратор мог его передать клиенту
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating customer', error });
    }
};

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
        const customers = await Customer.find().select('-password');
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customers', error });
    }
};

export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
        const customer = await Customer.findByIdAndDelete(req.params.id);
        if (!customer) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting customer', error });
    }
};

// Эндпоинт для получения собственных данных кастомером
export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { user } = req;
        
        // Проверяем что это кастомер
        if (!user || user.role !== 'customer' || !user.customerId) {
            res.status(403).json({ message: 'Forbidden: Only customers can access their profile' });
            return;
        }

        // Получаем актуальные данные из базы
        const customer = await Customer.findById(user.customerId).select('-password');
        
        if (!customer) {
            res.status(404).json({ message: 'Customer profile not found' });
            return;
        }

        console.log(`Customer ${customer.username} requested profile data`);

        res.json({
            message: 'Customer profile data',
            profile: {
                _id: customer._id,
                username: customer.username,
                botToken: customer.botToken,
                currentPrice: customer.currentPrice,
                basePrice: customer.basePrice,
                cardNumber: customer.cardNumber,
                cardHolderName: customer.cardHolderName,
                otherCountries: customer.otherCountries,
                sendTo: customer.sendTo,
                paymentInstructions: customer.paymentInstructions,
                createdAt: customer.createdAt,
                updatedAt: customer.updatedAt
            },
            tokenData: {
                customerId: user.customerId,
                username: user.username,
                botToken: user.botToken
            }
        });
    } catch (error) {
        console.error('Error getting customer profile:', error);
        res.status(500).json({ message: 'Error fetching profile', error });
    }
};

// Эндпоинт для обновления собственных данных кастомером
export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { user } = req;
        
        // Проверяем что это кастомер
        if (!user || user.role !== 'customer' || !user.customerId) {
            res.status(403).json({ message: 'Forbidden: Only customers can update their profile' });
            return;
        }

        // Поля, которые кастомер может обновлять (исключаем пароль и username)
        const allowedFields = ['botToken', 'currentPrice', 'basePrice', 'cardNumber', 'cardHolderName', 'otherCountries', 'sendTo', 'paymentInstructions'];
        const updateData: any = {};

        // Фильтруем только разрешенные поля
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ message: 'No valid fields to update', allowedFields });
            return;
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            user.customerId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedCustomer) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        console.log(`Customer ${updatedCustomer.username} updated profile:`, Object.keys(updateData));

        res.json({
            message: 'Profile updated successfully',
            profile: updatedCustomer,
            updatedFields: Object.keys(updateData)
        });
    } catch (error) {
        console.error('Error updating customer profile:', error);
        res.status(500).json({ message: 'Error updating profile', error });
    }
};

// Эндпоинт для n8n - получение данных кастомера по customerId через API ключ
export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { customerId } = req.body;

        if (!customerId) {
            res.status(400).json({ message: 'customerId is required' });
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            res.status(400).json({ message: 'Invalid customerId format' });
            return;
        }

        // Получаем данные кастомера из базы (без пароля)
        const customer = await Customer.findById(customerId).select('-password');
        
        if (!customer) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        console.log(`N8N requested customer data for: ${customer.username} (${customerId})`);

        res.json({
            success: true,
            message: 'Customer data retrieved successfully',
            customer: {
                _id: customer.id,
                username: customer.username,
                botToken: customer.botToken,
                currentPrice: customer.currentPrice,
                basePrice: customer.basePrice,
                cardNumber: customer.cardNumber,
                cardHolderName: customer.cardHolderName,
                otherCountries: customer.otherCountries,
                sendTo: customer.sendTo,
                paymentInstructions: customer.paymentInstructions,
                createdAt: customer.createdAt,
                updatedAt: customer.updatedAt
            }
        });
    } catch (error) {
        console.error('Error getting customer by ID for n8n:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching customer data', 
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Новый контроллер для обновления подписки администратором
export const updateCustomerSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params; // ID кастомера
        const { status, endsAt, tariff } = req.body; // 'active', 'inactive', 'expired'

        if (!status || !['active', 'inactive', 'expired'].includes(status)) {
            res.status(400).json({ message: 'Valid status is required: active, inactive, or expired.' });
            return;
        }

        const { botManager } = await import('../services/botManager.service');
        const result = await botManager.updateSubscription(id, status, endsAt ? new Date(endsAt) : undefined);

        if (!result.success || !result.customer) {
            res.status(404).json({ message: result.message || 'Customer not found.' });
            return;
        }
        
        const customerToUpdate = result.customer;

        // Дополнительно обновим тариф, если он передан
        if (tariff && ['basic', 'pro'].includes(tariff)) {
            customerToUpdate.tariff = tariff;
            await customerToUpdate.save();
        }

        res.json({
            message: `Subscription for customer ${customerToUpdate.username} updated successfully.`,
            customer: customerToUpdate
        });

    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ message: 'Error updating subscription', error });
    }
};
