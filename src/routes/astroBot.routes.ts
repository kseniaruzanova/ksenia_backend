import { Router, Request, Response } from 'express';
import { Telegraf } from "telegraf";
import { AstroBotChat, AstroBotMessage } from "../models/astrobot.model";

const astroRoutes = Router();

const AstroBotToken = process.env.ASTROBOT_TOKEN || ""; 
export const AstroBot = new Telegraf(AstroBotToken);

// Получение статистики
astroRoutes.get("/stats", async (req: Request, res: Response) => {
  try {
    const totalChats = await AstroBotChat.countDocuments();
    const totalMessages = await AstroBotMessage.countDocuments();
    
    // Сообщения за последние 24 часа
    const messagesLast24h = await AstroBotMessage.countDocuments({
      date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    // Активные чаты сегодня (чаты с сообщениями за последние 24 часа)
    const activeChatsToday = await AstroBotMessage.distinct('chatId', {
      date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    res.json({
      ok: true,
      data: {
        totalChats,
        totalMessages,
        messagesLast24h,
        activeChatsToday: activeChatsToday.length
      }
    });
  } catch (err) {
    console.error("Ошибка при /astro/stats:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Получение списка всех чатов с информацией о последнем сообщении
astroRoutes.get("/chats", async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Получаем чаты с пагинацией
    const chats = await AstroBotChat.find()
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v')
      .lean();

    // Для каждого чата получаем последнее сообщение и количество непрочитанных
    const chatsWithMessages = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await AstroBotMessage.findOne({ chatId: chat.chatId })
          .sort({ date: -1 })
          .select('text date')
          .lean();

        // Здесь можно добавить логику для подсчета непрочитанных сообщений
        const unreadCount = 0; // Заглушка - в реальном приложении нужно отслеживать прочитанные сообщения

        return {
          ...chat,
          lastMessage: lastMessage ? {
            text: lastMessage.text,
            date: lastMessage.date
          } : null,
          unreadCount
        };
      })
    );

    const totalChats = await AstroBotChat.countDocuments();

    res.json({
      ok: true,
      data: {
        chats: chatsWithMessages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalChats,
          pages: Math.ceil(totalChats / limitNum)
        }
      }
    });
  } catch (err) {
    console.error("Ошибка при /astro/chats:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Получение информации о конкретном чате
astroRoutes.get("/chats/:chatId", async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    
    const chat = await AstroBotChat.findOne({ chatId })
      .select('-__v')
      .lean();
    
    if (!chat) {
      res.status(404).json({ ok: false, error: "Чат не найден" });
      return;
    }
    
    res.json({ ok: true, data: chat });
  } catch (err) {
    console.error("Ошибка при /astro/chats/:chatId:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Получение сообщений конкретного чата
astroRoutes.get("/chats/:chatId/messages", async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    // Проверяем существование чата
    const chatExists = await AstroBotChat.exists({ chatId });
    if (!chatExists) {
      res.status(404).json({ ok: false, error: "Чат не найден" });
      return;
    }
    
    const messages = await AstroBotMessage.find({ chatId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v')
      .lean();
    
    const totalMessages = await AstroBotMessage.countDocuments({ chatId });
    
    // Добавляем информацию о направлении сообщения
    const messagesWithDirection = messages.map(msg => ({
      ...msg,
      direction: msg.userId === 0 ? 'outgoing' : 'incoming'
    }));
    
    res.json({
      ok: true,
      data: {
        messages: messagesWithDirection,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalMessages,
          pages: Math.ceil(totalMessages / limitNum)
        }
      }
    });
  } catch (err) {
    console.error("Ошибка при /astro/chats/:chatId/messages:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Отправка сообщения
astroRoutes.post("/chats/:chatId/messages", async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      res.status(400).json({ ok: false, error: "Текст сообщения обязателен" });
      return;
    }
    
    // Проверяем существование чата
    const chat = await AstroBotChat.findOne({ chatId });
    if (!chat) {
      res.status(404).json({ ok: false, error: "Чат не найден" });
      return;
    }
    
    // Здесь должна быть логика отправки сообщения через Telegram API
    const msg = await AstroBot.telegram.sendMessage(chatId, text);
    
    // Сохраняем исходящее сообщение в базу
    const message = await AstroBotMessage.create({
      messageId: msg.message_id,
      chatId,
      userId: 0, // 0 означает исходящее сообщение от бота
      text: text.trim(),
      date: new Date(),
      isCallback: false
    });
    
    // Обновляем время последней активности чата
    await AstroBotChat.updateOne(
      { chatId },
      { updatedAt: new Date() }
    );
    
    res.json({
      ok: true,
      data: {
        message: {
          ...message.toObject(),
          direction: 'outgoing'
        }
      }
    });
  } catch (err) {
    console.error("Ошибка при /astro/chats/:chatId/messages:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Массовая рассылка
astroRoutes.post("/broadcast", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      res.status(400).json({ ok: false, error: "Текст сообщения обязателен" });
      return;
    }
    
    // Получаем все чаты
    const chats = await AstroBotChat.find().select('chatId');
    const chatIds = chats.map(chat => chat.chatId);
    
    for (const chatId of chatIds) {
      await AstroBot.telegram.sendMessage(chatId, text.trim());
    }
    
    // Сохраняем исходящие сообщения в базу
    const messages = await Promise.all(
      chatIds.map(chatId => 
        AstroBotMessage.create({
          messageId: Date.now() + Math.random(),
          chatId,
          userId: 0,
          text: text.trim(),
          date: new Date(),
          isCallback: false
        })
      )
    );
    
    res.json({
      ok: true,
      data: {
        sentCount: chatIds.length,
        message: "Массовая рассылка выполнена успешно"
      }
    });
  } catch (err) {
    console.error("Ошибка при /astro/broadcast:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

astroRoutes.post("/incoming", async (req: Request, res: Response) => {
  try {
    const updateData = req.body as any;
    let ctx: any;
    let isCallback = false;

    let buttonText = '';

    if (updateData.callback_query) {
      ctx = updateData.callback_query;
      isCallback = true;
      
      const callbackData = ctx.data;
      const inlineKeyboard = ctx.message?.reply_markup?.inline_keyboard;
      
      if (inlineKeyboard && Array.isArray(inlineKeyboard)) {
        for (const row of inlineKeyboard) {
          for (const button of row) {
            if (button.callback_data === callbackData) {
              buttonText = button.text;
              break;
            }
          }
          if (buttonText) break;
        }
      }
    } else if (updateData.message) {
      ctx = updateData.message;
    } else {
      res.json({ ok: true, info: "Unknown update type" });
    }

    const chatId = ctx.chat?.id || ctx.from?.id;
    const userId = ctx.from?.id;

    if (chatId) {
      await AstroBotChat.updateOne( 
        { chatId }, 
        { 
          chatId, 
          type: ctx.chat?.type || "private", 
          title: "title" in ctx.from ? ctx.from.title : undefined, 
          username: "username" in ctx.from ? ctx.from.username : ctx.chat?.username, 
          firstName: "first_name" in ctx.from ? ctx.from.first_name : ctx.chat?.first_name, 
          lastName: "last_name" in ctx.from ? ctx.from.last_name : ctx.chat?.last_name, 
          updatedAt: new Date()
        }, 
        { upsert: true } 
      );
    }

    // Обрабатываем текст в зависимости от типа запроса
    let text: string | undefined;
    
    if (isCallback) {
      text = `Я нажал на кнопку: ${buttonText || ctx.data}`;
    } else {
      text = "text" in ctx ? ctx.text : undefined;
    }

    await AstroBotMessage.create({ 
      messageId: isCallback ? ctx.message?.message_id : ctx.message_id, 
      chatId, 
      userId, 
      text,
      raw: updateData, 
      date: new Date(("date" in ctx ? ctx.date : ctx.message.date) * 1000),
      isCallback,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Ошибка при /astroBot/incoming:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

astroRoutes.post("/outgoing", async (req: Request, res: Response) => {
  try {
    const body = req.body as any;

    if (!body.ok || !body.result) {
      res.status(400).json({ ok: false, error: "Некорректный формат JSON" });
      return;
    }

    const msg = body.result;

    await AstroBotMessage.create({
			messageId: msg.message_id,
			chatId: msg.chat.id,
			userId: msg.from?.id || 0,
			text: msg.text,
			raw: msg,
			date: new Date(msg.date * 1000 + 2000),
		});

    res.json({ ok: true });
  } catch (err) {
    console.error("Ошибка при /astro/outgoing:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default astroRoutes;
