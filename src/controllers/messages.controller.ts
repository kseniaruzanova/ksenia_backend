import { Response } from 'express';
import { AuthRequest } from '../interfaces/authRequest';
import { Chat } from '../models/chat.model';
import { Message } from '../models/messages.model';
import User from '../models/user.model';
import botManager from '../services/botManager.service';

/**
 * Отправить одиночное сообщение
 * POST /api/messages/send
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, role } = req.user!;
    const { chat_id, message } = req.body;

    if (role !== 'customer') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    if (!chat_id || !message) {
      res.status(400).json({ message: 'chat_id and message are required' });
      return;
    }

    if (!botManager) {
      res.status(500).json({ message: 'Bot manager not initialized' });
      return;
    }

    try {
      await botManager.sendMessage(customerId!, chat_id, message);

      res.json({ 
        message: 'Message sent successfully'
      });
    } catch (sendError) {
      console.error('Error sending message via bot:', sendError);
      res.status(500).json({ 
        message: 'Failed to send message via bot', 
        error: sendError instanceof Error ? sendError.message : 'Unknown error' 
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      message: 'Failed to send message', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Массовая отправка сообщений
 * POST /api/messages/mass
 */
export const sendMassMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, role } = req.user!;
    const { chat_ids, message } = req.body;

    if (role !== 'customer') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    if (!chat_ids || !Array.isArray(chat_ids) || chat_ids.length === 0 || !message) {
      res.status(400).json({ message: 'chat_ids (array) and message are required' });
      return;
    }

    const results = {
      success: [] as string[],
      failed: [] as { chatId: string; error: string }[]
    };

    // Отправляем сообщения
    for (const chat_id of chat_ids) {
      try {
        // Отправляем сообщение
        await botManager.sendMessage(customerId!, chat_id, message);

        results.success.push(chat_id);
      } catch (error) {
        results.failed.push({ 
          chatId: chat_id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    res.json({ 
      message: 'Mass message sending completed',
      results
    });
  } catch (error) {
    console.error('Error sending mass messages:', error);
    res.status(500).json({ 
      message: 'Failed to send mass messages', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Отправка broadcast сообщения всем пользователям
 * POST /api/messages/broadcast
 */
export const sendBroadcastMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, role } = req.user!;
    const { message } = req.body;

    if (role !== 'customer') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    if (!message) {
      res.status(400).json({ message: 'message is required' });
      return;
    }

    // Получаем все активные чаты клиента
    const chats = await Chat.find({ 
      customerId, 
      status: 'active' 
    });

    const results = {
      success: [] as string[],
      failed: [] as { chatId: string; error: string }[],
      total: chats.length
    };

    // Отправляем сообщения всем чатам
    for (const chat of chats) {
      try {
        await botManager.sendMessage(customerId!, chat.chatId, message);

        results.success.push(chat.chatId);
      } catch (error) {
        results.failed.push({ 
          chatId: chat.chatId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    res.json({ 
      message: 'Broadcast message sending completed',
      results
    });
  } catch (error) {
    console.error('Error sending broadcast message:', error);
    res.status(500).json({ 
      message: 'Failed to send broadcast message', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Получить историю сообщений конкретного чата
 * GET /api/messages/history/:chatId
 */
export const getMessageHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, role } = req.user!;
    const { chatId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    if (role !== 'customer') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Находим чат
    const chat = await Chat.findOne({ 
      customerId, 
      chatId 
    });

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    // Получаем сообщения
    const [messages, total] = await Promise.all([
      Message.find({ chatId: chat._id })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ chatId: chat._id })
    ]);

    // Сортируем в правильном порядке для отображения
    messages.reverse();

    res.json({
      messages,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ 
      message: 'Failed to fetch message history', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Включить/выключить режим прямого общения с админом
 * PUT /api/messages/admin-chat-mode
 */
export const toggleAdminChatMode = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, role } = req.user!;
    const { chatId, enabled } = req.body;

    if (role !== 'customer') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    if (!chatId || enabled === undefined) {
      res.status(400).json({ message: 'chatId and enabled are required' });
      return;
    }

    // Находим пользователя
    const user = await User.findOne({ 
      chat_id: chatId, 
      customerId: customerId 
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Обновляем режим админа
    user.adminChatMode = enabled as boolean;
    await user.save();

    console.log(`🔧 Admin chat mode ${enabled ? 'ENABLED' : 'DISABLED'} for chat ${chatId}`);

    res.json({ 
      message: `Admin chat mode ${enabled ? 'enabled' : 'disabled'} successfully`,
      adminChatMode: user.adminChatMode 
    });
  } catch (error) {
    console.error('Error toggling admin chat mode:', error);
    res.status(500).json({ 
      message: 'Failed to toggle admin chat mode', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};
