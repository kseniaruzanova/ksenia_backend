import { Router, Request, Response } from "express";
import { AstroBotChat, AstroBotMessage } from "../models/astrobot.model";

const astroRoutes = Router();

astroRoutes.post("/incoming", async (req: Request, res: Response) => {
  try {
    const body = req.body as any;

    if (body.chatId) {
      await AstroBotChat.updateOne(
        { chatId: body.chatId },
        {
          chatId: body.chatId,
          type: body.type,
          title: body.title,
          username: body.username,
          firstName: body.firstName,
          lastName: body.lastName,
        },
        { upsert: true }
      );
    }

    await AstroBotMessage.create({
      messageId: body.messageId,
      chatId: body.chatId,
      userId: body.userId,
      text: body.text,
      raw: body.raw,
      date: body.date ? new Date(body.date) : new Date(),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Ошибка при /astro/incoming:", err);
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
