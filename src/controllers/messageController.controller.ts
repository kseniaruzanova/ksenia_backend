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

    // Функция для безопасного преобразования ID
    const toSafeObjectId = (id: string) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch (e) {
        return null;
      }
    };

    console.log(chat_id);
    console.log(customerId);
    const chatIdObj = toSafeObjectId(chat_id);
    const customerIdObj = toSafeObjectId(customerId!);

    if (!chatIdObj) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат ID чата'
      });
    }

    // Проверяем доступ к чату
    if (!isAdmin) {
      if (!customerIdObj) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат customerId'
        });
      }

      const hasAccess = await Message.exists({
        chatId: chatIdObj,
        customerId: customerIdObj
      });
      
      if (!hasAccess) {
        return res.status(403).json({ 
          success: false, 
          message: 'Нет доступа к этому чату' 
        });
      }
    }

    const query: any = { 
      chatId: chatIdObj
    };

    if (!isAdmin) {
      query.customerId = customerIdObj;
    }

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    // Получаем информацию о пользователе чата
    const userInfo = await User.findOne({ _id: chatIdObj }, { 
      state: 1,
      birthday: 1,
      updatedAt: 1
    });

    res.json({
      success: true,
      messages: messages.reverse(),
      userInfo: userInfo || {}
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
