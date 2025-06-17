import { Request, Response } from 'express';
import Customer from '../models/customer.model';
import { randomBytes } from 'crypto';

// Функция для генерации случайного пароля
const generatePassword = (length = 8) => {
    return randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};

export const createCustomer = async (req: Request, res: Response) => {
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

export const getCustomers = async (req: Request, res: Response) => {
    try {
        const customers = await Customer.find().select('-password');
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching customers', error });
    }
};

export const deleteCustomer = async (req: Request, res: Response) => {
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