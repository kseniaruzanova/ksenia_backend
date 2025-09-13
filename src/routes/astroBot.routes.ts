import { Router, Request, Response } from 'express';
import { AstroBotChat, AstroBotMessage } from "../models/astrobot.model";

const astroRoutes = Router();

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
      date: new Date("date" in ctx ? ctx.date : ctx.message.date * 1000), 
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

    if (!body.chatId || !body.text) {
      res.status(400).json({ ok: false, error: "chatId и text обязательны" });
      return;
    }

    // const msg = await AstroBot.telegram.sendMessage(body.chatId, body.text, body.extra || {});

    // await AstroBotMessage.create({
    //   messageId: msg.message_id,
    //   chatId: body.chatId,
    //   userId: 0,
    //   text: msg.text,
    //   raw: msg,
    //   date: new Date(msg.date * 1000),
    // });

    res.json({ ok: true });
  } catch (err) {
    console.error("Ошибка при /astro/outgoing:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default astroRoutes; 
