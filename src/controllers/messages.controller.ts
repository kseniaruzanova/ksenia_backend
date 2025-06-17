import { Request, Response } from 'express';
import { Telegraf } from 'telegraf';
import MessageLog from '../models/messageLog.model';
import User from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';

// Эта функция теперь принимает токен бота как аргумент
const sendExternalMessage = async (botToken: string, chat_id: string, message: string): Promise<{ success: boolean; error?: string }> => {
    try {
        if (!botToken) {
            return { success: false, error: 'Bot token is not provided for this customer.' };
        }
        const bot = new Telegraf(botToken);
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

// Проверка, что запрос пришел от клиента
const getCustomerCredentials = (req: AuthRequest) => {
    const { user } = req;
    if (user?.role !== 'customer' || !user.customerId || !user.botToken) {
        return null;
    }
    return { customerId: user.customerId, botToken: user.botToken };
};

export const sendSingleMessage = async (req: AuthRequest, res: Response) => {
    const credentials = getCustomerCredentials(req);
    if (!credentials) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }

    const { chat_id, message } = req.body;
    if (!chat_id || !message) {
        res.status(400).json({ message: 'chat_id and message are required' });
        return;
    }

    try {
        const result = await sendExternalMessage(credentials.botToken, chat_id, message);
        const log = new MessageLog({
            chat_id,
            message,
            status: result.success ? 'sent' : 'failed',
            error: result.error,
            customerId: credentials.customerId,
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

export const sendMassMessage = async (req: AuthRequest, res: Response) => {
    const credentials = getCustomerCredentials(req);
    if (!credentials) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }

    const { chat_ids, message } = req.body;
    if (!chat_ids || !Array.isArray(chat_ids) || !message) {
        res.status(400).json({ message: 'chat_ids (array) and message are required' });
        return;
    }

    const results = [];
    for (const chat_id of chat_ids) {
        const result = await sendExternalMessage(credentials.botToken, chat_id, message);
        const log = new MessageLog({
            chat_id,
            message,
            status: result.success ? 'sent' : 'failed',
            error: result.error,
            customerId: credentials.customerId,
        });
        await log.save();
        results.push({ chat_id, ...result });
    }

    res.status(200).json({ message: 'Mass messaging process completed', results });
};

export const broadcastMessage = async (req: AuthRequest, res: Response) => {
    const credentials = getCustomerCredentials(req);
    if (!credentials) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }

    const { message } = req.body;
    if (!message) {
        res.status(400).json({ message: 'message is required' });
        return;
    }

    try {
        const users = await User.find({ customerId: credentials.customerId }, 'chat_id');
        
        const results = [];
        for (const user of users) {
            const result = await sendExternalMessage(credentials.botToken, user.chat_id, message);
            const log = new MessageLog({
                chat_id: user.chat_id,
                message,
                status: result.success ? 'sent' : 'failed',
                error: result.error,
                customerId: credentials.customerId,
            });
            await log.save();
            results.push({ chat_id: user.chat_id, ...result });
        }

        res.status(200).json({ 
            message: 'Broadcast completed', 
            statistics: {
                total: users.length,
                success: results.filter(r => r.success).length,
                failure: results.filter(r => !r.success).length
            },
            results 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error during broadcast', error });
    }
};

export const getMessageLogs = async (req: AuthRequest, res: Response) => {
    const credentials = getCustomerCredentials(req);
    if (!credentials) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }

    const { chat_id } = req.query;
    const query: { customerId: string, chat_id?: string } = { customerId: credentials.customerId };
    if (chat_id) {
        query.chat_id = chat_id as string;
    }

    try {
        const logs = await MessageLog.find(query).sort({ createdAt: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching message logs', error });
    }
}; 