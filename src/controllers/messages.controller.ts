import { Request, Response } from 'express';
import MessageLog from '../models/messageLog.model';
import User from '../models/user.model';
import bot from '../config/telegram.config';

// This is a mock function. In a real application, this would interact
// with a messaging service like Telegram, WhatsApp, etc.
const sendExternalMessage = async (chat_id: string, message: string): Promise<{ success: boolean; error?: string }> => {
    try {
        await bot.telegram.sendMessage(chat_id, message);
        return { success: true };
    } catch (error) {
        console.error('Error sending telegram message:', error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};


export const sendSingleMessage = async (req: Request, res: Response): Promise<void> => {
    const { chat_id, message } = req.body;

    if (!chat_id || !message) {
        res.status(400).json({ message: 'chat_id and message are required' });
        return;
    }

    try {
        // Here you would call the actual messaging service
        const result = await sendExternalMessage(chat_id, message);

        const log = new MessageLog({
            chat_id,
            message,
            status: result.success ? 'sent' : 'failed',
            error: result.error,
        });
        await log.save();

        if (!result.success) {
            res.status(500).json({ message: 'Failed to send message', error: result.error });
            return;
        }

        res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending message', error });
    }
};

export const sendMassMessage = async (req: Request, res: Response): Promise<void> => {
    const { chat_ids, message } = req.body;

    if (!chat_ids || !Array.isArray(chat_ids) || !message) {
        res.status(400).json({ message: 'chat_ids (array) and message are required' });
        return;
    }

    const results = [];
    for (const chat_id of chat_ids) {
        const result = await sendExternalMessage(chat_id, message);
        const log = new MessageLog({
            chat_id,
            message,
            status: result.success ? 'sent' : 'failed',
            error: result.error,
        });
        await log.save();
        results.push({ chat_id, ...result });
    }

    res.status(200).json({ message: 'Mass messaging process completed', results });
};

export const broadcastMessage = async (req: Request, res: Response) => {
    const { message } = req.body;

    if (!message) {
        res.status(400).json({ message: 'message is required' });
        return;
    }

    try {
        // Получаем всех пользователей из базы
        const users = await User.find({}, 'chat_id');
        
        const results = [];
        let successCount = 0;
        let failureCount = 0;

        // Отправляем сообщение каждому пользователю
        for (const user of users) {
            const result = await sendExternalMessage(user.chat_id, message);
            
            // Логируем отправку
            const log = new MessageLog({
                chat_id: user.chat_id,
                message,
                status: result.success ? 'sent' : 'failed',
                error: result.error,
            });
            await log.save();

            // Подсчитываем статистику
            if (result.success) {
                successCount++;
            } else {
                failureCount++;
            }

            results.push({ chat_id: user.chat_id, ...result });
        }

        res.status(200).json({ 
            message: 'Broadcast completed', 
            statistics: {
                total: users.length,
                success: successCount,
                failure: failureCount
            },
            results 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error during broadcast', error });
    }
};

export const getMessageLogs = async (req: Request, res: Response): Promise<void> => {
    const { chat_id } = req.query;
    if (!chat_id) {
        res.status(400).json({ message: 'chat_id query parameter is required' });
        return;
    }

    try {
        const logs = await MessageLog.find({ chat_id }).sort({ createdAt: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching message logs', error });
    }
}; 