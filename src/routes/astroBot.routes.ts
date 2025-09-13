import { Router, Request, Response } from "express";
import { AstroBotChat, AstroBotMessage } from "../models/astrobot.model";

const astroRoutes = Router();

astroRoutes.post("/incoming", async (req: Request, res: Response) => {
  try {
    const ctx = req.body.message as any;

		const chatId = ctx.chat.id; 
		const userId = ctx.chat.id; 

    if (chatId) {
      await AstroBotChat.updateOne( 
        { chatId }, 
        { 
            chatId, 
            type: ctx.chat.type, 
            title: "title" in ctx.chat ? ctx.chat.title : undefined, 
            username: "username" in ctx.chat ? ctx.chat.username : undefined, 
            firstName: "first_name" in ctx.chat ? ctx.chat.first_name : undefined, 
            lastName: "last_name" in ctx.chat ? ctx.chat.last_name : undefined, 
        }, 
        { upsert: true } 
			);
    }

     
    await AstroBotMessage.create({ 
			messageId: ctx.message_id, 
			chatId, 
			userId, 
			text: "text" in ctx ? ctx.text : undefined, 
			raw: ctx, 
			date: new Date(ctx.date * 1000), 
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
