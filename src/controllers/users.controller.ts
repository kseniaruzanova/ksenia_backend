import { Request, Response } from 'express';
import User from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

// Проверка, что запрос пришел от клиента
const getCustomerId = (req: AuthRequest) => {
    const { user } = req;
    console.log('User from JWT:', user);
    
    if (user?.role === 'admin') {
        return 'admin'; // Специальное значение для администратора
    }
    if (user?.role !== 'customer' || !user.customerId) {
        console.log('User validation failed:', { role: user?.role, customerId: user?.customerId });
        return null;
    }
    // console.log(req)
    console.log('Customer ID from JWT:', user.customerId, 'Type:', typeof user.customerId);
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
            // Преобразуем customerId в ObjectId для правильного сравнения
            const customerObjectId = new mongoose.Types.ObjectId(customerIdOrAdmin);
            query.customerId = customerObjectId;
            console.log('Customer ObjectId for query:', customerObjectId);
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

        console.log(`Found ${count} users for query:`, query);

        res.json({
            users,
            totalPages: Math.ceil(count / Number(limit)),
            currentPage: Number(page),
            totalUsers: count,
            isAdmin: customerIdOrAdmin === 'admin'
        });
    } catch (error) {
        console.error('Error in getUsers:', error);
        res.status(500).json({ message: 'Error fetching users', error });
    }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
    const customerIdOrAdmin = getCustomerId(req);
    if (!customerIdOrAdmin) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }
    
    try {
        const chat_id = req.params.id;
        const query: any = { chat_id };
        
        // Кастомеры видят только своих пользователей
        if (customerIdOrAdmin !== 'admin') {
            const customerObjectId = new mongoose.Types.ObjectId(customerIdOrAdmin);
            query.customerId = customerObjectId;
        }
        
        const user = await User.findOne(query);
        
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json(user);
    } catch (error) {
        console.error('Error in getUserById:', error);
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

// Временный эндпоинт для диагностики (только для админов)
export const debugData = async (req: AuthRequest, res: Response) => {
    const customerIdOrAdmin = getCustomerId(req);
    
    // Только админ может видеть отладочную информацию
    if (customerIdOrAdmin !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        // Получаем всех пользователей с их customerId
        const users = await User.find({}, 'chat_id customerId state').limit(20);
        
        // Получаем всех кастомеров
        const Customer = require('../models/customer.model').default;
        const customers = await Customer.find({}, 'username _id').limit(20);

        res.json({
            message: 'Debug data',
            users: users.map(u => ({
                chat_id: u.chat_id,
                customerId: u.customerId.toString(),
                state: u.state
            })),
            customers: customers.map((c: any) => ({
                _id: c._id.toString(),
                username: c.username
            }))
        });
    } catch (error) {
        console.error('Error in debug:', error);
        res.status(500).json({ message: 'Error getting debug data', error });
    }
};

// Эндпоинт для исправления индексов (только для админа)
export const fixIndexes = async (req: AuthRequest, res: Response) => {
    const customerIdOrAdmin = getCustomerId(req);
    
    // Только админ может исправлять индексы
    if (customerIdOrAdmin !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        console.log('Starting index fix process...');
        
        // Получаем текущие индексы
        const indexes = await User.collection.listIndexes().toArray();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        // Ищем проблемный индекс только по chat_id
        const chatIdIndex = indexes.find((idx: any) => 
            idx.name === 'chat_id_1' || 
            (idx.key && Object.keys(idx.key).length === 1 && idx.key.chat_id === 1)
        );

        let droppedIndex = null;
        if (chatIdIndex) {
            console.log('Found problematic index:', chatIdIndex.name);
            try {
                await User.collection.dropIndex(chatIdIndex.name);
                droppedIndex = chatIdIndex.name;
                console.log(`Dropped index: ${chatIdIndex.name}`);
            } catch (error) {
                console.log('Error dropping index (may not exist):', error);
            }
        }

        // Проверяем есть ли правильный составной индекс
        const compositeIndex = indexes.find((idx: any) => 
            idx.key && 
            idx.key.chat_id === 1 && 
            idx.key.customerId === 1 &&
            Object.keys(idx.key).length === 2
        );

        let createdIndex = null;
        if (!compositeIndex) {
            console.log('Creating proper composite index...');
            await User.collection.createIndex(
                { chat_id: 1, customerId: 1 }, 
                { unique: true, name: 'chat_id_1_customerId_1' }
            );
            createdIndex = 'chat_id_1_customerId_1';
            console.log('Created composite index: chat_id_1_customerId_1');
        }

        // Получаем финальные индексы
        const finalIndexes = await User.collection.listIndexes().toArray();
        
        res.json({
            message: 'Index fix completed',
            actions: {
                droppedIndex,
                createdIndex,
                hasProperIndex: !!compositeIndex || !!createdIndex
            },
            finalIndexes: finalIndexes.map((idx: any) => ({
                name: idx.name,
                key: idx.key,
                unique: idx.unique || false
            }))
        });
    } catch (error) {
        console.error('Error fixing indexes:', error);
        res.status(500).json({ message: 'Error fixing indexes', error });
    }
}; 