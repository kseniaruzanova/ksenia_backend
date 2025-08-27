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
        const token = jwt.sign({ username: adminLogin, role: 'admin', tariff: "pro" }, jwtSecret, { expiresIn: '8h' });
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
                botToken: customer.botToken,
                tariff: customer.tariff
            };
            console.log(payload)
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

// Эндпоинт для проверки текущего токена и получения актуальных данных
export const verifyToken = async (req: any, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
        res.status(500).json({ message: 'Server configuration error' });
        return;
    }

    try {
        // Декодируем токен
        const decoded = jwt.verify(token, jwtSecret) as any;
        console.log('Current JWT data:', decoded);

        // Если это кастомер, проверяем актуальные данные в базе
        if (decoded.role === 'customer') {
            const customer = await Customer.findById(decoded.customerId);
            
            if (!customer) {
                res.status(404).json({ message: 'Customer not found in database' });
                return;
            }

            const actualData = {
                username: customer.username,
                customerId: customer._id,
                botToken: customer.botToken
            };

            const tokenData = {
                username: decoded.username,
                customerId: decoded.customerId,
                botToken: decoded.botToken
            };

            console.log('Token data vs DB data:', { tokenData, actualData });

            res.json({
                message: 'Token verification',
                tokenValid: true,
                tokenData: decoded,
                actualData,
                dataMatches: JSON.stringify(tokenData) === JSON.stringify(actualData),
                tokenAge: Math.floor((Date.now() / 1000) - decoded.iat),
                expiresIn: decoded.exp - Math.floor(Date.now() / 1000)
            });
        } else {
            // Для админа
            res.json({
                message: 'Admin token verification',
                tokenValid: true,
                tokenData: decoded,
                tokenAge: Math.floor((Date.now() / 1000) - decoded.iat),
                expiresIn: decoded.exp - Math.floor(Date.now() / 1000)
            });
        }
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ message: 'Invalid token', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

// Эндпоинт для обновления токена актуальными данными из базы
export const refreshToken = async (req: any, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }

    const oldToken = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
        res.status(500).json({ message: 'Server configuration error' });
        return;
    }

    try {
        // Декодируем старый токен
        const decoded = jwt.verify(oldToken, jwtSecret) as any;

        if (decoded.role === 'admin') {
            // Для админа просто обновляем время
            const newToken = jwt.sign({ 
                username: decoded.username, 
                role: 'admin' 
            }, jwtSecret, { expiresIn: '8h' });
            
            res.json({ 
                message: 'Admin token refreshed',
                token: newToken, 
                role: 'admin' 
            });
            return;
        }

        if (decoded.role === 'customer') {
            // Для кастомера получаем актуальные данные из базы
            const customer = await Customer.findById(decoded.customerId);
            
            if (!customer) {
                res.status(404).json({ message: 'Customer not found' });
                return;
            }

            // Создаем новый токен с актуальными данными
            const payload = {
                username: customer.username,
                role: 'customer',
                customerId: customer._id,
                botToken: customer.botToken,
            };
            
            const newToken = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });
            
            console.log('Token refreshed for customer:', customer.username);
            
            res.json({ 
                message: 'Customer token refreshed with actual data',
                token: newToken, 
                role: 'customer',
                customerId: customer._id
            });
            return;
        }

        res.status(400).json({ message: 'Unknown user role' });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ message: 'Invalid token', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}; 