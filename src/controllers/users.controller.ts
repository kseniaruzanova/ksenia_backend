import { Request, Response } from 'express';
import User from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';

// Проверка, что запрос пришел от клиента
const getCustomerId = (req: AuthRequest) => {
    const { user } = req;
    if (user?.role !== 'customer' || !user.customerId) {
        return null;
    }
    return user.customerId;
};

export const getUsers = async (req: AuthRequest, res: Response) => {
    const customerId = getCustomerId(req);
    if (!customerId) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }

    try {
        const { page = 1, limit = 10, chat_id, state } = req.query;

        const query: any = { customerId };
        if (chat_id) query.chat_id = chat_id;
        if (state) query.state = state;

        const users = await User.find(query)
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit))
            .exec();

        const count = await User.countDocuments(query);

        res.json({
            users,
            totalPages: Math.ceil(count / Number(limit)),
            currentPage: Number(page),
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