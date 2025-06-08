import { Request, Response } from 'express';
import User from '../models/user.model';

export const getUsers = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, chat_id, state } = req.query;

        const query: any = {};
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

export const getUserById = async (req: Request, res: Response) => {
    try {
        const chat_id = req.params.id;
        const user = await User.findOne({ chat_id });
        
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user', error });
    }
}; 