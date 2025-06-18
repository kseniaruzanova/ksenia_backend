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
        
        console.log(`Attempting to send message to chat_id: ${chat_id} with bot token: ${botToken.substring(0, 10)}...`);
        
        const bot = new Telegraf(botToken);
        await bot.telegram.sendMessage(chat_id, message);
        
        console.log(`Message successfully sent to chat_id: ${chat_id}`);
        return { success: true };
    } catch (error: any) {
        console.error('Error sending telegram message:', error);
        
        // Более подробная обработка ошибок от Telegram API
        let errorMessage = 'Unknown error';
        
        if (error.response) {
            // Ошибка от Telegram API
            const { error_code, description } = error.response;
            errorMessage = `Telegram API Error ${error_code}: ${description}`;
            
            // Специальная обработка распространенных ошибок
            if (error_code === 400) {
                if (description.includes('chat not found')) {
                    errorMessage = 'Chat not found. Возможно, пользователь не начал диалог с ботом или заблокировал его.';
                } else if (description.includes('Forbidden')) {
                    errorMessage = 'Bot blocked by user. Пользователь заблокировал бота.';
                }
            } else if (error_code === 401) {
                errorMessage = 'Invalid bot token. Проверьте правильность токена бота.';
            } else if (error_code === 404) {
                errorMessage = 'Chat not found or bot has no access to this chat. Проверьте, что пользователь начал диалог с ботом.';
            }
            
            console.error(`Telegram API Error Details: Code ${error_code}, Description: ${description}`);
        } else {
            errorMessage = error.message || 'Unknown error';
        }
        
        return { 
            success: false, 
            error: errorMessage
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

// Функция для проверки состояния бота и доступности чата
const checkBotAndChat = async (botToken: string, chat_id: string): Promise<{ success: boolean; botInfo?: any; chatInfo?: any; error?: string }> => {
    try {
        if (!botToken) {
            return { success: false, error: 'Bot token is not provided' };
        }

        const bot = new Telegraf(botToken);
        
        // Проверяем информацию о боте
        const botInfo = await bot.telegram.getMe();
        console.log(`Bot info: @${botInfo.username} (${botInfo.first_name})`);
        
        // Пытаемся получить информацию о чате
        try {
            const chatInfo = await bot.telegram.getChat(chat_id);
            console.log(`Chat info for ${chat_id}:`, chatInfo);
            return { success: true, botInfo, chatInfo };
        } catch (chatError: any) {
            console.error(`Error getting chat info for ${chat_id}:`, chatError);
            return { 
                success: false, 
                botInfo, 
                error: `Chat access error: ${chatError.description || chatError.message}` 
            };
        }
    } catch (error: any) {
        console.error('Error checking bot status:', error);
        return { 
            success: false, 
            error: `Bot error: ${error.description || error.message}` 
        };
    }
};

export const sendSingleMessage = async (req: AuthRequest, res: Response) => {
    const credentials = getCustomerCredentials(req);
    if (!credentials) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }

    console.log(`Customer ${credentials.customerId} attempting to send message`);

    const { chat_id, message } = req.body;
    if (!chat_id || !message) {
        res.status(400).json({ message: 'chat_id and message are required' });
        return;
    }

    console.log(`Sending message to chat_id: ${chat_id}, message length: ${message.length}`);

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

        console.log(`Message log saved: ${result.success ? 'SUCCESS' : 'FAILED'}`);

        if (!result.success) {
            console.error(`Failed to send message to ${chat_id}: ${result.error}`);
            res.status(500).json({ message: 'Failed to send message', error: result.error });
            return;
        }
        res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Unexpected error in sendSingleMessage:', error);
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

// Новый эндпоинт для диагностики проблем с ботом и чатом
export const checkBotStatus = async (req: AuthRequest, res: Response) => {
    const credentials = getCustomerCredentials(req);
    if (!credentials) {
        res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
        return;
    }

    const { chat_id } = req.body;
    if (!chat_id) {
        res.status(400).json({ message: 'chat_id is required' });
        return;
    }

    try {
        const result = await checkBotAndChat(credentials.botToken, chat_id);
        
        if (result.success) {
            res.status(200).json({ 
                message: 'Bot and chat are accessible',
                botInfo: result.botInfo,
                chatInfo: result.chatInfo
            });
        } else {
            res.status(400).json({ 
                message: 'Bot or chat access issue',
                error: result.error,
                botInfo: result.botInfo
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error checking bot status', error });
    }
};

// Эндпоинт для n8n - отправка сообщения по customerId через API ключ
export const sendMessageFromN8N = async (req: Request, res: Response) => {
    try {
        const { customerId, chat_id, message } = req.body;

        // Валидация входных данных
        if (!customerId || !chat_id || !message) {
            res.status(400).json({ 
                success: false,
                message: 'customerId, chat_id and message are required' 
            });
            return;
        }

        // Импорт Customer модели
        const Customer = require('../models/customer.model').default;
        
        // Получаем данные кастомера из базы
        const customer = await Customer.findById(customerId);
        
        if (!customer) {
            res.status(404).json({ 
                success: false,
                message: 'Customer not found' 
            });
            return;
        }

        if (!customer.botToken) {
            res.status(400).json({ 
                success: false,
                message: 'Bot token not configured for this customer' 
            });
            return;
        }

        console.log(`N8N sending message via customer ${customer.username} (${customerId}) to chat ${chat_id}`);

        // Отправляем сообщение используя токен бота кастомера
        const result = await sendExternalMessage(customer.botToken, chat_id, message);
        
        // Сохраняем лог сообщения
        const log = new MessageLog({
            chat_id,
            message,
            status: result.success ? 'sent' : 'failed',
            error: result.error,
            customerId: customerId,
        });
        await log.save();

        console.log(`Message ${result.success ? 'sent successfully' : 'failed'} from N8N via ${customer.username}`);

        if (!result.success) {
            res.status(500).json({ 
                success: false,
                message: 'Failed to send message', 
                error: result.error,
                customer: customer.username
            });
            return;
        }

        res.status(200).json({ 
            success: true,
            message: 'Message sent successfully via N8N',
            customer: customer.username,
            chat_id,
            messageLength: message.length
        });
    } catch (error) {
        console.error('Error in sendMessageFromN8N:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error sending message from N8N', 
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}; 