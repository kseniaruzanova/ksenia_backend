import crypto from "crypto";
import { Telegraf, Context } from "telegraf";
import Customer from "../models/customer.model";
import TgChannelInviteToken from "../models/tgChannelInviteToken.model";
import TgChannelMember from "../models/tgChannelMember.model";

const TOKEN_TTL_MINUTES = 15;
let cachedBotUsername: string | null = null;

async function getBotUsername(): Promise<string> {
  if (cachedBotUsername) return cachedBotUsername;
  const token = process.env.TG_MAX_CHANNEL_BOT_TOKEN;
  if (!token) {
    throw new Error("TG_MAX_CHANNEL_BOT_TOKEN is not set in environment");
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data: any = await res.json();
  if (!data.ok || !data.result?.username) {
    throw new Error("Failed to get bot username from Telegram API");
  }
  cachedBotUsername = data.result.username;

  return cachedBotUsername || "";
}

export async function createInviteLink(customerId: string): Promise<{ link: string; token: string }> {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error("Customer not found");
  if (customer.tariff !== "tg_max") {
    throw new Error("Tariff is not tg_max");
  }
  if (customer.subscriptionStatus !== "active" || !customer.subscriptionEndsAt || customer.subscriptionEndsAt <= new Date()) {
    throw new Error("Subscription is not active");
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + TOKEN_TTL_MINUTES);

  await TgChannelInviteToken.create({
    token,
    customerId,
    expiresAt,
  });

  const username = await getBotUsername();
  const link = `https://t.me/${username}?start=${token}`;
  return { link, token };
}

export async function handleStartPayload(telegramUserId: number, startPayload: string): Promise<string> {
  const uid = Number(telegramUserId);
  if (!uid) {
    console.warn("tgChannel: handleStartPayload called with invalid telegramUserId", telegramUserId);
    return "Ошибка: не удалось определить пользователя.";
  }

  const tokenDoc = await TgChannelInviteToken.findOne({
    token: startPayload,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!tokenDoc) {
    console.warn("tgChannel: token not found or expired/used", { startPayloadLength: startPayload?.length, telegramUserId: uid });
    return "Ссылка недействительна или уже использована. Получите новую ссылку в личном кабинете.";
  }

  const customer = await Customer.findById(tokenDoc.customerId);
  if (!customer || customer.tariff !== "tg_max") {
    return "Ошибка: тариф недоступен.";
  }
  if (customer.subscriptionStatus !== "active" || !customer.subscriptionEndsAt || customer.subscriptionEndsAt <= new Date()) {
    return "Подписка истекла. Обратитесь к администратору.";
  }

  try {
    await TgChannelMember.findOneAndUpdate(
      { customerId: customer._id, telegramUserId: uid },
      {
        $set: {
          customerId: customer._id,
          telegramUserId: uid,
          subscriptionEndsAt: customer.subscriptionEndsAt,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    console.log("tgChannel: saved TgChannelMember", { customerId: customer._id, telegramUserId: uid, customerUsername: customer.username });
  } catch (err) {
    console.error("tgChannel: TgChannelMember save failed", { customerId: customer._id, telegramUserId: uid, err });
    throw err;
  }

  tokenDoc.usedAt = new Date();
  await tokenDoc.save();

  const channelId = process.env.TG_MAX_CHANNEL_ID;
  if (channelId) {
    try {
      const botToken = process.env.TG_MAX_CHANNEL_BOT_TOKEN;
      const inviteLinkRes = await fetch(
        `https://api.telegram.org/bot${botToken}/createChatInviteLink?chat_id=${encodeURIComponent(channelId)}&member_limit=1`
      );
      const inviteData: any = await inviteLinkRes.json();
      if (inviteData.ok && inviteData.result?.invite_link) {
        return `Добро пожаловать! Ваш доступ в канал активен до ${customer.subscriptionEndsAt.toLocaleDateString("ru-RU")}. Ссылка для входа: ${inviteData.result.invite_link}`;
      }
    } catch (_) {
      // ignore
    }
  }

  return `Вы успешно зарегистрированы. Доступ до ${customer.subscriptionEndsAt.toLocaleDateString("ru-RU")}.`;
}

function createWebhookMiddleware(): (req: any, res: any) => Promise<void> {
  const token = process.env.TG_MAX_CHANNEL_BOT_TOKEN;
  if (!token) {
    console.warn("TG_MAX_CHANNEL_BOT_TOKEN not set, max channel webhook will respond with 503");
    return async (_req: any, res: any) => {
      res.status(503).send("TG_MAX_CHANNEL_BOT_TOKEN not configured");
    };
  }

  const bot = new Telegraf(token);

  bot.start(async (ctx: Context) => {
    const msg = ctx.message;
    const text = msg && "text" in msg ? String(msg.text || "") : "";
    const payload = text.replace(/^\/start\s*/i, "").trim();
    const from = ctx.from;
    const telegramUserId = from?.id;
    console.log("tgChannel: /start received", { telegramUserId, payloadLength: payload.length, textPreview: text.slice(0, 50) });
    if (!telegramUserId) {
      console.warn("tgChannel: /start without from.id");
      return;
    }
    try {
      const message = await handleStartPayload(telegramUserId, payload);
      await ctx.reply(message);
    } catch (err) {
      console.error("tgChannel handleStartPayload error:", err);
      await ctx.reply("Произошла ошибка. Попробуйте получить новую ссылку в личном кабинете.");
    }
  });

  return async (req: any, res: any) => {
    let update = req.body;
    if (!update || typeof update !== "object") {
      console.warn("tgChannel webhook: empty or invalid body", { hasBody: !!update, type: typeof update });
      res.status(400).end();
      return;
    }
    if (typeof (update as any).update === "string") {
      try {
        update = JSON.parse((update as any).update);
      } catch (e) {
        console.warn("tgChannel webhook: failed to parse body.update string");
        res.status(400).end();
        return;
      }
    }
    try {
      await bot.handleUpdate(update, res);
    } catch (err) {
      console.error("tgChannel webhook error:", err);
      res.status(500).end();
    }
  };
}

export const tgChannelWebhookMiddleware = createWebhookMiddleware();

/**
 * Регистрирует webhook для бота «Доступ к ТГ и макс каналу» в Telegram.
 * Без этого при переходе по ссылке с сайта бот не получает обновления.
 * Требует в .env: TG_MAX_CHANNEL_BOT_TOKEN, API_PUBLIC_URL (например https://botprorok.ru)
 */
export async function registerMaxChannelWebhook(): Promise<void> {
  const token = process.env.TG_MAX_CHANNEL_BOT_TOKEN;
  const baseUrl = (process.env.API_PUBLIC_URL || process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (!token) {
    console.warn("⚠️ TG_MAX_CHANNEL_BOT_TOKEN not set, skipping max channel webhook registration.");
    return;
  }
  if (!baseUrl) {
    console.warn("⚠️ API_PUBLIC_URL (or PUBLIC_BASE_URL) not set, skipping max channel webhook registration. Set it to your public backend URL (e.g. https://botprorok.ru).");
    return;
  }
  const webhookUrl = `${baseUrl}/api/telegram-max-channel/webhook`;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    );
    const data: any = await res.json();
    if (data.ok) {
      console.log(`✅ Max channel bot webhook registered: ${webhookUrl}`);
    } else {
      console.error("❌ Max channel bot setWebhook failed:", data.description || data);
    }
  } catch (err) {
    console.error("❌ Failed to register max channel webhook:", err);
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Исключает пользователя из канала через banChatMember.
 * Возвращает { ok: true } при успехе или если бот/канал не настроены; { ok: false, error } при ошибке API.
 */
export async function kickUserFromChannel(telegramUserId: number): Promise<{ ok: boolean; error?: string }> {
  const botToken = process.env.TG_MAX_CHANNEL_BOT_TOKEN;
  const channelId = process.env.TG_MAX_CHANNEL_ID;
  if (!botToken || !channelId) {
    return { ok: true };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/banChatMember?chat_id=${encodeURIComponent(channelId)}&user_id=${telegramUserId}`
    );
    const data: any = await res.json().catch(() => ({}));
    if (data.ok) {
      return { ok: true };
    }
    const err = data.description || res.statusText || "Unknown error";
    console.warn(`tgChannel: banChatMember failed for user ${telegramUserId}:`, err);
    return { ok: false, error: err };
  } catch (e) {
    console.warn(`tgChannel: banChatMember request failed for user ${telegramUserId}:`, e);
    return { ok: false, error: String(e) };
  }
}

/**
 * Исключает из канала и удаляет из БД участников с истёкшей подпиской.
 * Вызывается раз в день по таймеру.
 */
export async function runExpiredTgChannelMembersCleanup(): Promise<void> {
  const now = new Date();
  const expired = await TgChannelMember.find({ subscriptionEndsAt: { $lt: now } }).lean();
  if (expired.length === 0) return;

  console.log(`tgChannel daily: found ${expired.length} member(s) with expired subscription`);

  let kicked = 0;
  let failed = 0;
  for (const member of expired) {
    const result = await kickUserFromChannel(member.telegramUserId);
    if (result.ok) {
      await TgChannelMember.deleteOne({ _id: member._id });
      kicked++;
    } else {
      failed++;
    }
  }
  console.log(`tgChannel daily: excluded ${kicked} member(s), failed to kick ${failed} (check bot admin rights in channel)`);
}

/**
 * Запускает ежедневную проверку: раз в сутки исключает из канала участников с истёкшей подпиской.
 */
export function startDailyExpiredSubscriptionCheck(): void {
  runExpiredTgChannelMembersCleanup().catch((err) =>
    console.error("tgChannel daily: cleanup failed:", err)
  );
  setInterval(() => {
    runExpiredTgChannelMembersCleanup().catch((err) =>
      console.error("tgChannel daily: cleanup failed:", err)
    );
  }, MS_PER_DAY);
  console.log("tgChannel: daily expired subscription check scheduled (every 24h)");
}
