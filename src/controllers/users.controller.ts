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
        const { page = 1, limit = 10, chat_id, state, sortBy } = req.query;

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

        // Настройка сортировки
        const sortOptions: any = {};
        if (sortBy === 'recent') {
            sortOptions.updatedAt = -1; // Сначала самые свежие
        } else {
            sortOptions.createdAt = -1; // По умолчанию - сначала новые
        }

        const usersQuery = User.find(query)
            .sort(sortOptions)
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
            
        const users = await usersQuery.exec();

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
                    state: 'new_chat'
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

// Эндпоинт для обновления конкретных полей пользователя (для n8n)
export const updateUserFields = async (req: Request, res: Response) => {
    try {
        const { 
            chat_id, 
            customerId, 
            answer_1, 
            state, 
            birthday, 
            usermessage2,
            answer_2,
            usermessage3,
            answer_3,
            answer_4,
            usermessage4,
            answer_5,
            usermessage5,
            answer_6,
            usermessage6,
            messages
        } = req.body;

        if (!chat_id || !customerId) {
            res.status(400).json({ 
                success: false,
                message: 'chat_id and customerId are required' 
            });
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            res.status(400).json({ 
                success: false,
                message: 'Invalid customerId format' 
            });
            return;
        }

        // Строим объект с полями для обновления (только переданные поля)
        const updateFields: any = {};
        if (answer_1 !== undefined) updateFields.answer_1 = answer_1;
        if (state !== undefined) updateFields.state = state;
        if (birthday !== undefined) updateFields.birthday = birthday;
        if (usermessage2 !== undefined) updateFields.usermessage2 = usermessage2;
        if (answer_2 !== undefined) updateFields.answer_2 = answer_2;
        if (usermessage3 !== undefined) updateFields.usermessage3 = usermessage3;
        if (answer_3 !== undefined) updateFields.answer_3 = answer_3;
        if (answer_4 !== undefined) updateFields.answer_4 = answer_4;
        if (usermessage4 !== undefined) updateFields.usermessage4 = usermessage4;
        if (answer_5 !== undefined) updateFields.answer_5 = answer_5;
        if (usermessage5 !== undefined) updateFields.usermessage5 = usermessage5;
        if (answer_6 !== undefined) updateFields.answer_6 = answer_6;
        if (usermessage6 !== undefined) updateFields.usermessage6 = usermessage6;
        if (messages !== undefined) updateFields.messages = messages;

        // Проверяем что есть хотя бы одно поле для обновления
        if (Object.keys(updateFields).length === 0) {
            res.status(400).json({ 
                success: false,
                message: 'At least one field must be provided for update: answer_1, state, birthday, usermessage2, answer_2, usermessage3, answer_3, answer_4, usermessage4, answer_5, usermessage5, answer_6, usermessage6, messages' 
            });
            return;
        }

        console.log(`Updating user ${chat_id} for customer ${customerId} with fields:`, Object.keys(updateFields));

        // Находим и обновляем пользователя
        const user = await User.findOneAndUpdate(
            { 
                chat_id: chat_id,
                customerId: customerId
            },
            { 
                $set: updateFields
            },
            { 
                new: true,
                runValidators: true
            }
        );

        if (!user) {
            res.status(404).json({ 
                success: false,
                message: 'User not found with provided chat_id and customerId' 
            });
            return;
        }

        console.log(`Successfully updated user ${chat_id} for customer ${customerId}`);

        res.status(200).json({ 
            success: true,
            message: 'User fields updated successfully', 
            user: {
                chat_id: user.chat_id,
                customerId: user.customerId,
                answer_1: user.answer_1,
                state: user.state,
                birthday: user.birthday,
                usermessage2: user.usermessage2,
                answer_2: user.answer_2,
                usermessage3: user.usermessage3,
                answer_3: user.answer_3,
                answer_4: user.answer_4,
                usermessage4: user.usermessage4,
                answer_5: user.answer_5,
                usermessage5: user.usermessage5,
                answer_6: user.answer_6,
                usermessage6: user.usermessage6,
                messages: user.messages,
                updatedAt: user.updatedAt
            },
            updatedFields: Object.keys(updateFields)
        });
    } catch (error) {
        console.error('Error updating user fields:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error updating user fields', 
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Эндпоинт для загрузки ВСЕХ пользователей одним запросом
export const getAllUsers = async (req: AuthRequest, res: Response) => {
    const customerIdOrAdmin = getCustomerId(req);
    if (!customerIdOrAdmin) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers and admins.' });
        return;
    }

    try {
        const query: any = {};
        
        // Основная фильтрация по customerId - ВСЕГДА для кастомеров
        if (customerIdOrAdmin !== 'admin') {
            // Преобразуем customerId в ObjectId для правильного сравнения
            const customerObjectId = new mongoose.Types.ObjectId(customerIdOrAdmin);
            query.customerId = customerObjectId;
            console.log(`Customer ${customerIdOrAdmin} requesting all their users`);
        } else {
            console.log('Admin requesting all users from all customers');
        }

        // Получаем всех пользователей без пагинации
        const users = await User.find(query)
            .sort({ createdAt: -1 }) // Сортировка по дате создания (новые первыми)
            .exec();

        console.log(`Found ${users.length} users for ${customerIdOrAdmin === 'admin' ? 'admin' : 'customer ' + customerIdOrAdmin}`);

        // Если админ, группируем пользователей по кастомерам для удобства
        if (customerIdOrAdmin === 'admin') {
            // Получаем информацию о кастомерах
            const Customer = require('../models/customer.model').default;
            const customers = await Customer.find({}, 'username _id');
            
            console.log(`Found ${customers.length} customers in database`);
            
            // Создаем мапу кастомеров
            const customerMap = new Map();
            customers.forEach((customer: any) => {
                customerMap.set(customer._id.toString(), customer.username);
            });

            // Группируем пользователей по кастомерам
            const usersByCustomer: any = {};
            const usersWithoutCustomer: any[] = [];
            
            users.forEach((user, index) => {
                // Проверяем что customerId существует
                if (!user.customerId) {
                    console.warn(`User ${user.chat_id || `at index ${index}`} has no customerId. User data:`, {
                        chat_id: user.chat_id,
                        state: user.state,
                        customerId: user.customerId,
                        _id: user._id
                    });
                    usersWithoutCustomer.push(user);
                    return;
                }
                
                const customerId = user.customerId.toString();
                const customerName = customerMap.get(customerId) || 'Unknown Customer';
                
                if (!usersByCustomer[customerId]) {
                    usersByCustomer[customerId] = {
                        customerId,
                        customerName,
                        users: []
                    };
                }
                usersByCustomer[customerId].users.push(user);
            });

            console.log(`Grouped users: ${Object.keys(usersByCustomer).length} customers, ${usersWithoutCustomer.length} users without customerId`);

            res.json({
                message: 'All users data for admin',
                isAdmin: true,
                totalUsers: users.length,
                totalCustomers: Object.keys(usersByCustomer).length,
                usersWithoutCustomer: usersWithoutCustomer.length > 0 ? usersWithoutCustomer : undefined,
                usersByCustomer,
                allUsers: users // Также возвращаем плоский список
            });
        } else {
            // Для кастомера просто возвращаем его пользователей
            res.json({
                message: 'All users data for customer',
                isAdmin: false,
                customerId: customerIdOrAdmin,
                totalUsers: users.length,
                users
            });
        }
    } catch (error) {
        console.error('Error in getAllUsers:', error);
        res.status(500).json({ message: 'Error fetching all users', error });
    }
}; 