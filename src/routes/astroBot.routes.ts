import { Router, Request, Response } from "express";
import { AstroBotChat, AstroBotMessage } from "../models/astrobot.model";

const astroRoutes = Router();

astroRoutes.post("/incoming", async (req: Request, res: Response) => {
  try {
    const body = req.body as any;

		const chatId = body.chat.id; 
		const userId = body.from?.id; 
		let text = ""; 
		if ("text" in body.message) { 
			text = body.message.text; 
		}

    if (chatId) {
      await AstroBotChat.updateOne( 
        { chatId }, 
        { 
            chatId, 
            type: body.chat.type, 
            title: "title" in body.chat ? body.chat.title : undefined, 
            username: body.from.username, 
            firstName: body.from.first_name, 
            lastName: body.from.last_name, 
        }, 
        { upsert: true } 
			);
    }

     
    await AstroBotMessage.create({ 
			messageId: body.message.message_id, 
			chatId, 
			userId, 
			text: "text" in body.message ? body.message.text : undefined, 
			raw: body.message, 
			date: new Date(body.message.date * 1000), 
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
