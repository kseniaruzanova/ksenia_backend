// import { Telegraf } from "telegraf";
// import { AstroBotChat, AstroBotMessage } from "../models/astrobot.model";

// const AstroBotToken = process.env.ASTROBOT_TOKEN || ""; 
// const n8nWebhook = "https://kseniaksenia.app.n8n.cloud/webhook/9f65eff9-f54e-4913-a71d-2aa764af6faf";

// export const AstroBot = new Telegraf(AstroBotToken);

// // ======================
// // 🔹 Хелпер: логирование исходящих
// // ======================
// async function logOutgoingMessage(chatId: number, msg: any) {
//   try {
//     await AstroBotMessage.create({
//       messageId: msg.message_id,
//       chatId,
//       userId: 0, // 0 или специальное значение для "бот"
//       text: msg.text || undefined,
//       raw: msg,
//       date: new Date(msg.date * 1000),
//     });

//     console.log(`📤 [${chatId}] BOT: ${msg.text ?? "[non-text]"}`);

//     // Форвард в n8n
//     await fetch(n8nWebhook, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ direction: "outgoing", message: msg }),
//     });
//   } catch (err) {
//     console.error("Ошибка при сохранении исходящего:", err);
//   }
// }

// AstroBot.on("message", async (ctx) => {
//   try {
//     const chatId = ctx.chat.id;
//     const userId = ctx.from?.id;

//     let text = "";
//     if ("text" in ctx.message) {
//       text = ctx.message.text;
//     }

//     await AstroBotChat.updateOne(
//       { chatId },
//       {
//         chatId,
//         type: ctx.chat.type,
//         title: "title" in ctx.chat ? ctx.chat.title : undefined,
//         username: ctx.from.username,
//         firstName: ctx.from.first_name,
//         lastName: ctx.from.last_name,
//       },
//       { upsert: true }
//     );

//     await AstroBotMessage.create({
//       messageId: ctx.message.message_id,
//       chatId,
//       userId,
//       text: "text" in ctx.message ? ctx.message.text : undefined,
//       raw: ctx.message,
//       date: new Date(ctx.message.date * 1000),
//     });

//     console.log(`💬 [${chatId}] ${userId}: ${text || "[non-text]"}`);

//     // Форвард входящего
//     await fetch(n8nWebhook, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(ctx.update),
//     });
//   } catch (err) {
//     console.error("Ошибка при сохранении:", err);
//   }
// });

// AstroBot.on("callback_query", async (ctx) => {
//   try {
//     console.log(ctx)
//     const chatId = ctx.chat?.id;
//     const userId = ctx.from?.id;
//     const query = ctx.callbackQuery;

//     const data = "data" in query ? query.data : undefined;

//     await AstroBotMessage.create({
//       messageId: query.id,
//       chatId,
//       userId,
//       text: data,
//       raw: query,
//       date: new Date(),
//     });

//     console.log(`🔘 [${chatId}] ${userId} callback: ${data}`);

//     await fetch(n8nWebhook, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(ctx.update),
//     });

//     await ctx.answerCbQuery();
//   } catch (err) {
//     console.error("Ошибка при обработке callback_query:", err);
//   }
// });

// const origSendMessage = AstroBot.telegram.sendMessage.bind(AstroBot.telegram);
// AstroBot.telegram.sendMessage = async (chatId: number, text: string, extra?: any) => {
//   const res = await origSendMessage(chatId, text, extra);
//   await logOutgoingMessage(chatId, res);
//   return res;
// };

// const origReply = (AstroBot.context as any).reply;
// (AstroBot.context as any).reply = async function (this: any, text: string, extra?: any) {
//   const res = await origReply.call(this, text, extra);
//   await logOutgoingMessage(this.chat?.id, res);
//   return res;
// };
