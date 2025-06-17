import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Customer from '../models/customer.model';

dotenv.config();

export const login = async (req: Request, res: Response) => {
    const { login: username, password } = req.body;
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
        res.status(500).json({ message: 'Server configuration error: JWT_SECRET not found' });
        return;
    }

    // 1. Попытка входа как суперадминистратор
    const adminLogin = process.env.ADMIN_LOGIN;
    const adminPassword = process.env.ADMIN_PASSWORD;

    console.log({ username, password })

    if (adminLogin && adminPassword && username === adminLogin && password === adminPassword) {
        const token = jwt.sign({ username: adminLogin, role: 'admin' }, jwtSecret, { expiresIn: '8h' });
        res.json({ token, role: 'admin' });
        return;
    }

    // 2. Попытка входа как клиент
    try {
        const customer = await Customer.findOne({ username });
        if (customer && password === customer.password) {
            const payload = {
                username: customer.username,
                role: 'customer',
                customerId: customer._id,
                botToken: customer.botToken, // Включаем токен бота в JWT
            };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });
            res.json({ token, role: 'customer' });
            return;
        }
    } catch (error) {
        res.status(500).json({ message: 'Error during customer authentication', error });
        return;
    }

    // 3. Если ни один из способов не подошел
    res.status(401).json({ message: 'Invalid credentials' });
}; 