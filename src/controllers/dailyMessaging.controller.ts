import { Response } from "express";

import { AuthRequest } from "../interfaces/authRequest";
import dailyMessagingService from "../services/dailyMessaging.service";
import DailyMessagingRunModel from "../models/dailyMessagingRun.model";

/**
 * Получить конфигурацию ежедневной отправки расклада
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
 * Обновить конфигурацию ежедневной отправки расклада
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
            time,
            timezone,
            maxConcurrency,
            perMessageDelayMs,
            promptSystem,
            promptUserTemplate,
            model,
            temperature,
            sendFormat
        } = req.body;

        const newConfig: any = {};

        if (enabled !== undefined) newConfig.enabled = enabled;
        if (time !== undefined) newConfig.time = time;
        if (timezone !== undefined) newConfig.timezone = timezone;
        if (maxConcurrency !== undefined) newConfig.maxConcurrency = Number(maxConcurrency);
        if (perMessageDelayMs !== undefined) newConfig.perMessageDelayMs = Number(perMessageDelayMs);
        if (promptSystem !== undefined) (newConfig as any).promptSystem = String(promptSystem);
        if (promptUserTemplate !== undefined) (newConfig as any).promptUserTemplate = String(promptUserTemplate);
        if (model !== undefined) (newConfig as any).model = String(model);
        if (temperature !== undefined) (newConfig as any).temperature = Number(temperature);
        if (sendFormat !== undefined) (newConfig as any).sendFormat = sendFormat === 'HTML' ? 'HTML' : 'Markdown';

        // Валидация времени
        if (time !== undefined) {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(time)) {
                res.status(400).json({ 
                    message: 'time must be in HH:MM format (e.g., "09:00")' 
                });
                return;
            }
        }

        // Валидация числа потоков и задержки
        if (newConfig.maxConcurrency !== undefined && (!Number.isFinite(newConfig.maxConcurrency) || newConfig.maxConcurrency < 1 || newConfig.maxConcurrency > 20)) {
            res.status(400).json({ 
                message: 'maxConcurrency must be an integer between 1 and 20' 
            });
            return;
        }
        if (newConfig.perMessageDelayMs !== undefined && (!Number.isFinite(newConfig.perMessageDelayMs) || newConfig.perMessageDelayMs < 0 || newConfig.perMessageDelayMs > 10000)) {
            res.status(400).json({ 
                message: 'perMessageDelayMs must be between 0 and 10000 ms' 
            });
            return;
        }
        if ((newConfig as any).temperature !== undefined && (!Number.isFinite((newConfig as any).temperature) || (newConfig as any).temperature < 0 || (newConfig as any).temperature > 2)) {
            res.status(400).json({ 
                message: 'temperature must be between 0 and 2' 
            });
            return;
        }

        await dailyMessagingService.updateConfig(newConfig);

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
 * Запустить планировщик ежедневной отправки расклада
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
 * Остановить планировщик ежедневной отправки расклада
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
 * Принудительно отправить ежедневный расклад сейчас
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
                successRate: result.total > 0 ? `${((result.success / result.total) * 100).toFixed(2)}%` : '0%'
            },
            results: result.results
        });
    } catch (error) {
        console.error('Error sending daily messages now:', error);
        res.status(500).json({ message: 'Error sending messages immediately', error });
    }
};

/**
 * Получить пользователей для ежедневной отправки расклада
 */
export const getUsersForDailyMessaging = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может видеть пользователей
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const users = await dailyMessagingService.getUsersForMessaging();

        res.json({
            message: 'Users for daily messaging',
            total: users.length,
            users: users.map(user => ({
                customerId: user.customerId,
                chatId: user.chatId,
                customerName: user.customerName
            }))
        });
    } catch (error) {
        console.error('Error getting users for daily messaging:', error);
        res.status(500).json({ message: 'Error fetching users', error });
    }
};

/**
 * Тестировать отправку ежедневного расклада одному пользователю
 */
export const testSingleDailyUser = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может тестировать
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const { customerId, chatId } = req.body;

        if (!customerId || !chatId) {
            res.status(400).json({ message: 'customerId and chatId are required' });
            return;
        }

        // Получаем пользователей для ежедневной отправки
        const users = await dailyMessagingService.getUsersForMessaging();
        const targetUser = users.find(u => u.customerId === customerId && u.chatId === chatId);

        if (!targetUser) {
            res.status(404).json({ 
                message: 'User not found or not eligible for daily messaging',
                customerId,
                chatId
            });
            return;
        }

        // Отправляем тестовое сообщение
        const result = await dailyMessagingService.sendDailyMessage(targetUser);

        if (result.success) {
            res.json({
                message: 'Test daily message sent successfully',
                user: {
                    customerId: targetUser.customerId,
                    chatId: targetUser.chatId,
                    customerName: targetUser.customerName
                },
                success: true
            });
        } else {
            res.status(500).json({
                message: 'Failed to send test daily message',
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
        console.error('Error testing single daily user:', error);
        res.status(500).json({ message: 'Error testing single user', error });
    }
};

/**
 * Получить статистику ежедневной отправки расклада
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
        const usersForMessaging = await dailyMessagingService.getUsersForMessaging();

        const lastRuns = await DailyMessagingRunModel.find({}).sort({ startedAt: -1 }).limit(5).lean();
        const aggregateLast7Days = await DailyMessagingRunModel.aggregate([
            { $match: { startedAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } } },
            { $group: { _id: null, total: { $sum: "$total" }, success: { $sum: "$success" }, failed: { $sum: "$failed" } } }
        ]);
        const agg = aggregateLast7Days[0] || { total: 0, success: 0, failed: 0 };

        res.json({
            message: 'Daily messaging statistics',
            config,
            status,
            userStats: {
                usersForDailyMessaging: usersForMessaging.length
            },
            recentRuns: lastRuns.map(r => ({
                startedAt: r.startedAt,
                finishedAt: r.finishedAt,
                total: r.total,
                success: r.success,
                failed: r.failed,
                successRate: r.successRate,
                trigger: r.trigger
            })),
            aggregate7d: {
                total: agg.total,
                success: agg.success,
                failed: agg.failed,
                successRate: agg.total > 0 ? Number(((agg.success / agg.total) * 100).toFixed(2)) : 0
            },
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting daily messaging stats:', error);
        res.status(500).json({ message: 'Error fetching statistics', error });
    }
};

/**
 * Получить историю отправки ежедневных сообщений
 */
export const getDailyMessagingHistory = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может видеть историю
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const { days = 7 } = req.query; // По умолчанию за последние 7 дней
        const history = await dailyMessagingService.getMessagingHistory(Number(days));

        res.json({
            message: 'Daily messaging history',
            period: `${days} days`,
            history
        });
    } catch (error) {
        console.error('Error getting daily messaging history:', error);
        res.status(500).json({ message: 'Error fetching history', error });
    }
};
