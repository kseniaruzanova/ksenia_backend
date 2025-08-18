import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { botManager } from '../services/botManager.service';
import User from '../models/user.model';

// Получить статистику входящих сообщений для кастомера
export const getIncomingMessagesStats = async (req: AuthRequest, res: Response) => {
    const { user } = req;
    
    if (!user || user.role !== 'customer' || !user.customerId) {
        res.status(403).json({ message: 'Forbidden: Only customers can access this endpoint' });
        return;
    }

    try {
        // Получаем всех пользователей кастомера
        const users = await User.find({ customerId: user.customerId });
        
        // Статистика по состояниям
        const stateStats = users.reduce((acc: any, user) => {
            acc[user.state] = (acc[user.state] || 0) + 1;
            return acc;
        }, {});

        // Статистика по сообщениям
        const messageStats = {
            totalUsers: users.length,
            usersWithAnswers: users.filter(u => u.answer_1 || u.answer_2 || u.answer_3).length,
            completedUsers: users.filter(u => u.state === 'completed').length,
            usersWithMessages: users.filter(u => u.messages && u.messages.length > 0).length
        };

        res.json({
            message: 'Incoming messages statistics',
            customerId: user.customerId,
            botInfo: botManager.getBotInfo(user.customerId),
            stateStats,
            messageStats,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting incoming messages stats:', error);
        res.status(500).json({ message: 'Error fetching statistics', error });
    }
};

// Получить последние входящие сообщения для кастомера
export const getRecentIncomingMessages = async (req: AuthRequest, res: Response) => {
    const { user } = req;
    
    if (!user || user.role !== 'customer' || !user.customerId) {
        res.status(403).json({ message: 'Forbidden: Only customers can access this endpoint' });
        return;
    }

    try {
        const { limit = 20, state, chat_id } = req.query;
        
        // Строим фильтр
        const filter: any = { customerId: user.customerId };
        if (state) filter.state = state;
        if (chat_id) filter.chat_id = chat_id;

        // Получаем пользователей с их данными
        const users = await User.find(filter)
            .sort({ updatedAt: -1 })
            .limit(Number(limit))
            .select('chat_id state answer_1 answer_2 answer_3 messages createdAt updatedAt');

        res.json({
            message: 'Recent incoming messages',
            customerId: user.customerId,
            filter,
            users,
            count: users.length,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting recent incoming messages:', error);
        res.status(500).json({ message: 'Error fetching messages', error });
    }
};

// Получить детальную информацию о пользователе по chat_id
export const getUserDetails = async (req: AuthRequest, res: Response) => {
    const { user } = req;
    
    if (!user || user.role !== 'customer' || !user.customerId) {
        res.status(403).json({ message: 'Forbidden: Only customers can access this endpoint' });
        return;
    }

    const { chat_id } = req.params;
    
    if (!chat_id) {
        res.status(400).json({ message: 'chat_id is required' });
        return;
    }

    try {
        // Находим пользователя
        const foundUser = await User.findOne({ 
            chat_id: chat_id, 
            customerId: user.customerId 
        });

        if (!foundUser) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        res.json({
            message: 'User details',
            customerId: user.customerId,
            user: {
                chat_id: foundUser.chat_id,
                state: foundUser.state,
                answer_1: foundUser.answer_1,
                answer_2: foundUser.answer_2,
                answer_3: foundUser.answer_3,
                answer_4: foundUser.answer_4,
                answer_5: foundUser.answer_5,
                answer_6: foundUser.answer_6,
                birthday: foundUser.birthday,
                usermessage2: foundUser.usermessage2,
                usermessage3: foundUser.usermessage3,
                usermessage4: foundUser.usermessage4,
                usermessage5: foundUser.usermessage5,
                usermessage6: foundUser.usermessage6,
                messages: foundUser.messages,
                createdAt: foundUser.createdAt,
                updatedAt: foundUser.updatedAt
            },
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting user details:', error);
        res.status(500).json({ message: 'Error fetching user details', error });
    }
};

// Админский эндпоинт для получения статистики по всем ботам
export const getAllIncomingMessagesStats = async (req: AuthRequest, res: Response) => {
    const { user } = req;
    
    if (!user || user.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        // Получаем статистику по всем кастомерам
        const allUsers = await User.aggregate([
            {
                $group: {
                    _id: '$customerId',
                    totalUsers: { $sum: 1 },
                    states: { $push: '$state' },
                    recentActivity: { $max: '$updatedAt' }
                }
            }
        ]);

        // Получаем информацию о ботах
        const allBots = botManager.getAllBots();
        const botStats = Array.from(allBots.values()).map(bot => ({
            customerId: bot.customerId,
            username: bot.username,
            status: bot.status,
            isListening: bot.isListening,
            lastUpdated: bot.lastUpdated
        }));

        // Объединяем статистику
        const combinedStats = allUsers.map(userStat => {
            const botInfo = Array.from(allBots.values()).find(bot => bot.customerId === userStat._id.toString());
            
            // Подсчитываем статистику по состояниям
            const stateStats = userStat.states.reduce((acc: any, state: string) => {
                acc[state] = (acc[state] || 0) + 1;
                return acc;
            }, {});

            return {
                customerId: userStat._id,
                username: botInfo?.username || 'Unknown',
                botStatus: botInfo?.status || 'not_found',
                isListening: botInfo?.isListening || false,
                totalUsers: userStat.totalUsers,
                stateStats,
                recentActivity: userStat.recentActivity
            };
        });

        res.json({
            message: 'All incoming messages statistics (Admin)',
            totalCustomers: allUsers.length,
            totalBots: allBots.size,
            botManagerStats: botManager.getStats(),
            customerStats: combinedStats,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting all incoming messages stats:', error);
        res.status(500).json({ message: 'Error fetching statistics', error });
    }
}; 