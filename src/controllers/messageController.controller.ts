import { Request, Response } from 'express';
import Message from '../models/messageLog.model';
import User from '../models/user.model';
import { Chat } from '../models/chat.model'; // Импортируем модель чата
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';

// Получение сообщений конкретного чата
export const getChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { chat_id, before } = req.body;
    const isAdmin = req.user?.role === 'admin';
    const customerId = req.user?.customerId;

    if (!chat_id) {
      return res.status(400).json({
        success: false,
        message: 'Не указан chat_id в теле запроса'
      });
    }

    // 1. Сначала находим чат в коллекции Chat
    const chat = await Chat.findOne({ 
      chatId: chat_id,
      ...(isAdmin ? {} : { customerId: new mongoose.Types.ObjectId(customerId) })
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Чат не найден или у вас нет доступа'
      });
    }

    // 2. Теперь ищем сообщения для этого чата
    const query: any = { 
      chatId: new mongoose.Types.ObjectId(chat.id) // Используем _id чата из коллекции Chat
    };

    if (!isAdmin) {
      query.customerId = new mongoose.Types.ObjectId(customerId);
    }

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    // 3. Получаем информацию о пользователе чата
    const userInfo = await User.findOne({ _id: chat._id }, { 
      state: 1,
      birthday: 1,
      updatedAt: 1
    });

    res.json({
      success: true,
      messages: messages.reverse(),
      userInfo: userInfo || {},
      chatMeta: chat.meta // Дополнительно возвращаем мета-информацию о чате
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при получении сообщений чата',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};