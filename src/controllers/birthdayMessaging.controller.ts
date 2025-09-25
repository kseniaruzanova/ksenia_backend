import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { birthdayMessagingService } from '../services/birthdayMessaging.service';

/**
 * Получить конфигурацию поздравлений с днем рождения
 */
export const getBirthdayMessagingConfig = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может видеть конфигурацию
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const config = birthdayMessagingService.getConfig();
        const status = birthdayMessagingService.getStatus();

        res.json({
            message: 'Birthday messaging configuration',
            config,
            status
        });
    } catch (error) {
        console.error('Error getting birthday messaging config:', error);
        res.status(500).json({ message: 'Error fetching configuration', error });
    }
};

/**
 * Обновить конфигурацию поздравлений с днем рождения
 */
export const updateBirthdayMessagingConfig = async (req: AuthRequest, res: Response) => {
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
            timezone
        } = req.body;

        const newConfig: any = {};

        if (enabled !== undefined) newConfig.enabled = enabled;
        if (time !== undefined) newConfig.time = time;
        if (timezone !== undefined) newConfig.timezone = timezone;

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

        birthdayMessagingService.updateConfig(newConfig);

        const updatedConfig = birthdayMessagingService.getConfig();
        const status = birthdayMessagingService.getStatus();

        res.json({
            message: 'Birthday messaging configuration updated',
            config: updatedConfig,
            status
        });
    } catch (error) {
        console.error('Error updating birthday messaging config:', error);
        res.status(500).json({ message: 'Error updating configuration', error });
    }
};

/**
 * Запустить планировщик поздравлений с днем рождения
 */
export const startBirthdayMessagingScheduler = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может управлять планировщиком
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        birthdayMessagingService.startBirthdayScheduler();
        const status = birthdayMessagingService.getStatus();

        res.json({
            message: 'Birthday messaging scheduler started',
            status
        });
    } catch (error) {
        console.error('Error starting birthday messaging scheduler:', error);
        res.status(500).json({ message: 'Error starting scheduler', error });
    }
};

/**
 * Остановить планировщик поздравлений с днем рождения
 */
export const stopBirthdayMessagingScheduler = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может управлять планировщиком
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        birthdayMessagingService.stopBirthdayScheduler();
        const status = birthdayMessagingService.getStatus();

        res.json({
            message: 'Birthday messaging scheduler stopped',
            status
        });
    } catch (error) {
        console.error('Error stopping birthday messaging scheduler:', error);
        res.status(500).json({ message: 'Error stopping scheduler', error });
    }
};

/**
 * Принудительно отправить поздравления с днем рождения сейчас
 */
export const sendBirthdayMessagesNow = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может принудительно отправлять сообщения
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const result = await birthdayMessagingService.sendNow();

        res.json({
            message: 'Birthday messages sent immediately',
            statistics: {
                total: result.total,
                success: result.success,
                failed: result.failed,
                successRate: `${((result.success / result.total) * 100).toFixed(2)}%`
            },
            results: result.results
        });
    } catch (error) {
        console.error('Error sending birthday messages now:', error);
        res.status(500).json({ message: 'Error sending messages immediately', error });
    }
};

/**
 * Получить пользователей с днем рождения сегодня
 */
export const getUsersWithBirthdayToday = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может видеть пользователей
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const users = await birthdayMessagingService.getUsersWithBirthday();

        res.json({
            message: 'Users with birthday today',
            total: users.length,
            users: users.map(user => ({
                customerId: user.customerId,
                chatId: user.chatId,
                customerName: user.customerName,
                birthday: user.birthday
            }))
        });
    } catch (error) {
        console.error('Error getting users with birthday today:', error);
        res.status(500).json({ message: 'Error fetching users', error });
    }
};

/**
 * Тестировать отправку поздравления одному пользователю
 */
export const testSingleBirthdayUser = async (req: AuthRequest, res: Response) => {
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

        // Получаем пользователей с днем рождения сегодня
        const users = await birthdayMessagingService.getUsersWithBirthday();
        const targetUser = users.find(u => u.customerId === customerId && u.chatId === chatId);

        if (!targetUser) {
            res.status(404).json({ 
                message: 'User not found or does not have birthday today',
                customerId,
                chatId
            });
            return;
        }

        // Отправляем тестовое поздравление
        const result = await birthdayMessagingService.sendBirthdayMessage(targetUser);

        if (result.success) {
            res.json({
                message: 'Test birthday message sent successfully',
                user: {
                    customerId: targetUser.customerId,
                    chatId: targetUser.chatId,
                    customerName: targetUser.customerName,
                    birthday: targetUser.birthday
                },
                success: true
            });
        } else {
            res.status(500).json({
                message: 'Failed to send test birthday message',
                user: {
                    customerId: targetUser.customerId,
                    chatId: targetUser.chatId,
                    customerName: targetUser.customerName,
                    birthday: targetUser.birthday
                },
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error testing single birthday user:', error);
        res.status(500).json({ message: 'Error testing single user', error });
    }
};

/**
 * Получить статистику поздравлений с днем рождения
 */
export const getBirthdayMessagingStats = async (req: AuthRequest, res: Response) => {
    const { user } = req;

    // Только админ может видеть статистику
    if (user?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden: Admin only' });
        return;
    }

    try {
        const config = birthdayMessagingService.getConfig();
        const status = birthdayMessagingService.getStatus();
        const usersWithBirthday = await birthdayMessagingService.getUsersWithBirthday();

        res.json({
            message: 'Birthday messaging statistics',
            config,
            status,
            userStats: {
                usersWithBirthdayToday: usersWithBirthday.length
            },
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error getting birthday messaging stats:', error);
        res.status(500).json({ message: 'Error fetching statistics', error });
    }
};
