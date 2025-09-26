import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { dailyMessagingService } from '../services/dailyMessaging.service';

/**
 * Получить конфигурацию ежедневных сообщений
 */
export const getDailyMessagingConfig = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может видеть конфигурацию
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const config = dailyMessagingService.getConfig();
        const status = dailyMessagingService.getStatus();

        res.json({
            message: 'Daily messaging configuration',
            config,
            status
        });
    } catch (error) {
        console.error('Error getting daily messaging config:', error);
        res.status(500).json({ message: 'Error fetching configuration', error });
    }
};

/**
 * Обновить конфигурацию ежедневных сообщений
 */
export const updateDailyMessagingConfig = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может обновлять конфигурацию
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const {
            enabled,
            minHour,
            maxHour
        } = req.body;

        const newConfig: any = {};

        if (enabled !== undefined) newConfig.enabled = enabled;
        if (minHour !== undefined) newConfig.minHour = minHour;
        if (maxHour !== undefined) newConfig.maxHour = maxHour;

        // Валидация
        if (minHour !== undefined && (minHour < 0 || minHour > 23)) {
            res.status(400).json({ 
                message: 'minHour must be between 0 and 23' 
            });
            return;
        }

        if (maxHour !== undefined && (maxHour < 0 || maxHour > 23)) {
            res.status(400).json({ 
                message: 'maxHour must be between 0 and 23' 
            });
            return;
        }

        if (minHour !== undefined && maxHour !== undefined && minHour >= maxHour) {
            res.status(400).json({ 
                message: 'minHour must be less than maxHour' 
            });
            return;
        }

        dailyMessagingService.updateConfig(newConfig);

        const updatedConfig = dailyMessagingService.getConfig();
        const status = dailyMessagingService.getStatus();

        res.json({
            message: 'Daily messaging configuration updated',
            config: updatedConfig,
            status
        });
    } catch (error) {
        console.error('Error updating daily messaging config:', error);
        res.status(500).json({ message: 'Error updating configuration', error });
    }
};

/**
 * Запустить планировщик ежедневных сообщений
 */
export const startDailyMessagingScheduler = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может управлять планировщиком
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        dailyMessagingService.startDailyScheduler();
        const status = dailyMessagingService.getStatus();

        res.json({
            message: 'Daily messaging scheduler started',
            status
        });
    } catch (error) {
        console.error('Error starting daily messaging scheduler:', error);
        res.status(500).json({ message: 'Error starting scheduler', error });
    }
};

/**
 * Остановить планировщик ежедневных сообщений
 */
export const stopDailyMessagingScheduler = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может управлять планировщиком
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        dailyMessagingService.stopDailyScheduler();
        const status = dailyMessagingService.getStatus();

        res.json({
            message: 'Daily messaging scheduler stopped',
            status
        });
    } catch (error) {
        console.error('Error stopping daily messaging scheduler:', error);
        res.status(500).json({ message: 'Error stopping scheduler', error });
    }
};

/**
 * Принудительно отправить ежедневные сообщения сейчас
 */
export const sendDailyMessagesNow = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может принудительно отправлять сообщения
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const result = await dailyMessagingService.sendNow();

        res.json({
            message: 'Daily messages sent immediately',
            statistics: {
                total: result.total,
                success: result.success,
                failed: result.failed,
                successRate: `${((result.success / result.total) * 100).toFixed(2)}%`
            },
            results: result.results
        });
    } catch (error) {
        console.error('Error sending daily messages now:', error);
        res.status(500).json({ message: 'Error sending messages immediately', error });
    }
};

/**
 * Тестировать отправку сообщения одному пользователю
 */
export const testSingleUser = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может тестировать
    // if (user?.role !== 'admin') {
    //     res.status(403).json({ message: 'Forbidden: Admin only' });
    //     return;
    // }

    try {
        const { customerId, chatId } = req.body;

        if (!customerId || !chatId) {
            res.status(400).json({ message: 'customerId and chatId are required' });
            return;
        }

        // Получаем конкретного пользователя
        const users = await dailyMessagingService.getAllUsers(customerId, chatId);

        if (users.length === 0) {
            res.status(404).json({ 
                message: 'User not found',
                customerId,
                chatId
            });
            return;
        }

        const targetUser = users[0]; // Берем первого (и единственного) пользователя

        // Отправляем тестовое сообщение
        const result = await dailyMessagingService.sendPersonalizedMessage(
            customerId, 
            chatId, 
            targetUser.customerName
        );

        if (result.success) {
            res.json({
                message: 'Test message sent successfully',
                user: {
                    customerId: targetUser.customerId,
                    chatId: targetUser.chatId,
                    customerName: targetUser.customerName
                },
                success: true
            });
        } else {
            res.status(500).json({
                message: 'Failed to send test message',
                user: {
                    customerId: targetUser.customerId,
                    chatId: targetUser.chatId,
                    customerName: targetUser.customerName
                },
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error testing single user:', error);
        res.status(500).json({ message: 'Error testing single user', error });
    }
};

/**
 * Получить пользователей по кастомеру
 */
export const getUsersByCustomer = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может видеть пользователей
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const { customerId } = req.query;

        if (!customerId) {
            res.status(400).json({ message: 'customerId is required' });
            return;
        }

        const users = await dailyMessagingService.getAllUsers(customerId as string);

        res.json({
            message: 'Users found for customer',
            customerId,
            total: users.length,
            users: users.map(user => ({
                customerId: user.customerId,
                chatId: user.chatId,
                customerName: user.customerName
            }))
        });
    } catch (error) {
        console.error('Error getting users by customer:', error);
        res.status(500).json({ message: 'Error fetching users', error });
    }
};

/**
 * Получить логи отправленных сообщений для пользователя
 */
export const getSentMessagesLogs = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может видеть логи
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const { customerId, chatId, limit = 10 } = req.query;

        if (!customerId || !chatId) {
            res.status(400).json({ message: 'customerId and chatId are required' });
            return;
        }

        const DailyMessageLog = require('../models/dailyMessageLog.model').default;
        const mongoose = require('mongoose');
        
        const customerObjectId = new mongoose.Types.ObjectId(customerId);
        
        const logs = await DailyMessageLog.find({ 
            customerId: customerObjectId, 
            chatId 
        })
        .sort({ sentAt: -1 })
        .limit(Number(limit))
        .lean();

        interface LogEntry {
            message: string;
            userMessages: string[];
            sentAt: Date;
            createdAt: Date;
        }

        res.json({
            message: 'Sent messages logs',
            customerId,
            chatId,
            total: logs.length,
            logs: logs.map((log: LogEntry) => ({
                message: log.message,
                userMessages: log.userMessages,
                sentAt: log.sentAt,
                createdAt: log.createdAt
            }))
        });
    } catch (error) {
        console.error('Error getting sent messages logs:', error);
        res.status(500).json({ message: 'Error fetching logs', error });
    }
};

/**
 * Получить статистику ежедневных сообщений
 */
export const getDailyMessagingStats = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может видеть статистику
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const config = dailyMessagingService.getConfig();
        const status = dailyMessagingService.getStatus();
        const users = await dailyMessagingService.getAllUsers(); // Без параметров - всех пользователей

        res.json({
            message: 'Daily messaging statistics',
            config,
            status,
            userStats: {
                totalUsers: users.length,
                customersCount: new Set(users.map(u => u.customerId)).size
            },
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting daily messaging stats:', error);
        res.status(500).json({ message: 'Error fetching statistics', error });
    }
};
