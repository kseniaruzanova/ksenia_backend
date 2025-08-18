import { Request, Response } from 'express';
import Message  from '../models/messageLog.model';
import User from '../models/user.model';
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

    // Проверяем доступ к чату
    if (!isAdmin) {
      const hasAccess = await Message.exists({
        chatId: new mongoose.Types.ObjectId(chat_id),
        customerId: new mongoose.Types.ObjectId(customerId)
      });
      
      if (!hasAccess) {
        return res.status(403).json({ 
          success: false, 
          message: 'Нет доступа к этому чату' 
        });
      }
    }

    const query: any = { 
      chatId: new mongoose.Types.ObjectId(chat_id)
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

    // Получаем информацию о пользователе чата
    const userInfo = await User.findOne({ chat_id }, { 
      state: 1,
      birthday: 1,
      updatedAt: 1
    });

    res.json({
      success: true,
      messages: messages.reverse(), // Чтобы новые были внизу
      userInfo: userInfo || {}
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при получении сообщений чата',
      error: ""
    });
  }
};
