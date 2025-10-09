import { Response } from 'express';
import { AuthRequest } from '../interfaces/authRequest';
import { Chat } from '../models/chat.model';
import { Message } from '../models/messages.model';

/**
 * Получить все чаты для клиента
 * GET /api/chats
 */
export const getAllChats = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, role } = req.user!;

    if (role !== 'customer') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Получаем чаты с пагинацией, сортированные по последнему сообщению
    const [chats, total] = await Promise.all([
      Chat.find({ customerId })
        .sort({ 'meta.lastMessageAt': -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Chat.countDocuments({ customerId })
    ]);

    res.json({
      chats,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ 
      message: 'Failed to fetch chats', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Получить информацию о конкретном чате
 * GET /api/chats/:chatId
 */
export const getChatById = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, role } = req.user!;
    const { chatId } = req.params;

    if (role !== 'customer') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const chat = await Chat.findOne({ 
      customerId, 
      chatId 
    }).lean();

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    res.json({ chat });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ 
      message: 'Failed to fetch chat', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Получить сообщения чата
 * POST /api/chats/messages
 */
export const getChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, role } = req.user!;
    const { chat_id, before, limit = 30 } = req.body;

    if (role !== 'customer') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Находим чат
    const chat = await Chat.findOne({ 
      customerId, 
      chatId: chat_id 
    });

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    // Строим запрос для получения сообщений
    const query: any = { chatId: chat._id };
    
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    // Получаем сообщения
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Проверяем, есть ли еще сообщения
    const hasMore = messages.length === limit;

    // Сортируем сообщения по возрастанию для отображения
    messages.reverse();

    res.json({
      messages,
      hasMore,
      userInfo: {
        chatId: chat.chatId,
        state: chat.status,
        meta: chat.meta
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      message: 'Failed to fetch messages', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Обновить информацию о чате
 * PATCH /api/chats/:chatId
 */
export const updateChat = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, role } = req.user!;
    const { chatId } = req.params;
    const updates = req.body;

    if (role !== 'customer') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const chat = await Chat.findOneAndUpdate(
      { customerId, chatId },
      { $set: updates },
      { new: true }
    );

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    res.json({ chat });
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({ 
      message: 'Failed to update chat', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};
