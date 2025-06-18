import { Request, Response } from 'express';
import User from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

// Проверка, что запрос пришел от клиента
const getCustomerId = (req: AuthRequest) => {
    const { user } = req;
    if (user?.role === 'admin') {
        return 'admin'; // Специальное значение для администратора
    }
    if (user?.role !== 'customer' || !user.customerId) {
        return null;
    }
    // console.log(req)
    return user.customerId;
};

export const getUsers = async (req: AuthRequest, res: Response) => {
    const customerIdOrAdmin = getCustomerId(req);
    if (!customerIdOrAdmin) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }

    try {
        const { page = 1, limit = 10, chat_id, state } = req.query;

        const query: any = {};
        
        // Основная фильтрация по customerId - ВСЕГДА для кастомеров
        if (customerIdOrAdmin !== 'admin') {
            query.customerId = customerIdOrAdmin; // Кастомер видит только своих пользователей
        }
        // Админ может видеть всех пользователей всех кастомеров

        // Дополнительные фильтры (опциональные) - работают в рамках уже отфильтрованных данных
        if (chat_id) query.chat_id = chat_id;
        if (state) query.state = state;

        console.log(`Query for ${customerIdOrAdmin === 'admin' ? 'admin' : 'customer ' + customerIdOrAdmin}:`, query);

        const users = await User.find(query)
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit))
            .exec();

        const count = await User.countDocuments(query);

        res.json({
            users,
            totalPages: Math.ceil(count / Number(limit)),
            currentPage: Number(page),
            totalUsers: count,
            isAdmin: customerIdOrAdmin === 'admin'
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error });
    }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
    const customerId = getCustomerId(req);
    if (!customerId) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }
    
    try {
        const chat_id = req.params.id;
        const user = await User.findOne({ chat_id, customerId });
        
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user', error });
    }
};

export const upsertUser = async (req: Request, res: Response) => {
    const { chat_id, customerId, ...userData } = req.body;

    if (!chat_id || !customerId) {
        res.status(400).json({ message: 'chat_id and customerId are required' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
        res.status(400).json({ message: 'Invalid customerId format' });
        return;
    }

    try {
        const user = await User.findOneAndUpdate(
            { 
                chat_id: chat_id,
                customerId: customerId
            },
            { 
                $set: {
                    ...userData,
                    chat_id: chat_id,
                    customerId: customerId 
                },
                $setOnInsert: {
                    state: 'step_1'
                }
            },
            { 
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        res.status(200).json({ message: 'User upserted successfully', user });
    } catch (error) {
        console.error('Error during user upsert:', error);
        res.status(500).json({ message: 'Error upserting user', error });
    }
};

export const checkUserExists = async (req: Request, res: Response) => {
    const { chat_id, customerId } = req.body;

    if (!chat_id || !customerId) {
        res.status(400).json({ message: 'chat_id and customerId are required' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
        res.status(400).json({ message: 'Invalid customerId format' });
        return;
    }

    try {
        const user = await User.findOne({ 
            chat_id: chat_id,
            customerId: customerId
        });

        if (user) {
            res.status(200).json({ exists: true, user: user });
        } else {
            res.status(200).json({ exists: false });
        }
    } catch (error) {
        console.error('Error during user check:', error);
        res.status(500).json({ message: 'Error checking user existence', error });
    }
}; 