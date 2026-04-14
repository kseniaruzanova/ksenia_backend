import { Request, Response } from "express";

import { AuthRequest } from "../interfaces/authRequest";
import { createProdamusPayLink } from "../utils/prodamus";
import User from "../models/user.model";
import Customer from "../models/customer.model";
import ClubMember from "../models/clubMember.model";
import { updatePayerSubscription } from "../utils/subscriptionPayer";
import Payment from "../models/payment.model";
import botManager from "../services/botManager.service";

export const getLinkProdamusBasic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user } = req;
    
    if (!user || user.role !== 'customer' || !user.customerId) {
      res.status(403).json({ message: 'Forbidden: Only customers can access their profile' });
      return;
    }

    const link = createProdamusPayLink("astroxenia", {
      customer_extra: user.customerId,
      subscription: 2473695,
      urlReturn: "https://botprorok.ru/",
      urlSuccess: "https://botprorok.ru/notification/success"
    });

    res.status(200).json({
      message: 'Customer profile data',
      link: link
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error });
  }
};

export const getLinkProdamusPro = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user } = req;
    
    if (!user || user.role !== 'customer' || !user.customerId) {
      res.status(403).json({ message: 'Forbidden: Only customers can access their profile' });
      return;
    }

    const link = createProdamusPayLink("astroxenia", {
      customer_extra: user.customerId,
      subscription: 2474522,
      urlReturn: "https://botprorok.ru",
      urlSuccess: "https://botprorok.ru/notification/success"
    });

    res.status(200).json({
      message: 'Customer profile data',
      link: link
    });
  } catch (error) {
    console.error('Error getting customer profile:', error);
    res.status(500).json({ message: 'Error fetching profile', error });
  }
};

export const getLinkProdamusTgMax = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user } = req;

    const payerId = user?.customerId || user?.clubMemberId;
    if (!user || (user.role !== "customer" && user.role !== "club_member") || !payerId) {
      res.status(403).json({ message: "Forbidden: Only customers can access their profile" });
      return;
    }

    const link = createProdamusPayLink("astroxenia", {
      customer_extra: payerId,
      subscription: 2775978,
      urlReturn: "https://botprorok.ru/",
      urlSuccess: "https://botprorok.ru/notification/success"
    });

    res.status(200).json({
      message: 'Customer profile data',
      link: link
    });
  } catch (error) {
    console.error('Error getting TG Max payment link:', error);
    res.status(500).json({ message: 'Error fetching profile', error });
  }
};

/** Prodamus шлёт либо плоские ключи subscription[...] (form), либо вложенный объект subscription (JSON). */
function readProdamusSubscription(data: any): {
  subscriptionId: string;
  activeUser: string | undefined;
  dateNextPayment: string | undefined;
} | null {
  const nested =
    data?.subscription && typeof data.subscription === "object" && !Array.isArray(data.subscription)
      ? data.subscription
      : null;

  const fromFlat = data?.["subscription[id]"];
  const fromNested = nested?.id;
  const subscriptionId =
    fromFlat !== undefined && fromFlat !== null && String(fromFlat).trim() !== ""
      ? String(fromFlat).trim()
      : fromNested !== undefined && fromNested !== null && String(fromNested).trim() !== ""
        ? String(fromNested).trim()
        : "";

  if (!subscriptionId) return null;

  let activeUser: string | undefined;
  if (data?.["subscription[active_user]"] !== undefined && data?.["subscription[active_user]"] !== null) {
    activeUser = String(data["subscription[active_user]"]);
  } else if (nested?.active_user !== undefined && nested?.active_user !== null) {
    activeUser = String(nested.active_user);
  }

  let dateNextPayment: string | undefined;
  if (data?.["subscription[date_next_payment]"]) {
    dateNextPayment = String(data["subscription[date_next_payment]"]);
  } else if (nested?.date_next_payment) {
    dateNextPayment = String(nested.date_next_payment);
  }

  return { subscriptionId, activeUser, dateNextPayment };
}

/**
 * Универсальный webhook для обработки всех типов платежей от Prodamus
 * Определяет тип платежа и вызывает соответствующую логику
 */
export const handleProdamusWebhook = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    console.log("📩 Prodamus webhook received:", JSON.stringify(data, null, 2));

    // Определяем тип платежа по наличию специфических полей
    const isSubscription = readProdamusSubscription(data) !== null;
    const paymentType = data._param_payment_type;
    const isUserSubscriptionPayment = paymentType === 'user_subscription';
    const isTarotPayment =
      !isUserSubscriptionPayment &&
      (paymentType === 'tarot' ||
        (paymentType === undefined && data._param_user !== undefined && data._param_customer_id !== undefined));

    console.log(`🔍 Payment type detection: subscription=${isSubscription}, userSubscription=${isUserSubscriptionPayment}, tarot=${isTarotPayment}`);

    if (isSubscription) {
      console.log("🔄 Processing as subscription payment");
      return await processSubscriptionPayment(data, res);
    } else if (isUserSubscriptionPayment) {
      console.log("💎 Processing as user subscription payment");
      return await processUserSubscriptionPayment(data, res);
    } else if (isTarotPayment) {
      console.log("🔮 Processing as tarot reading payment");
      return await processTarotPayment(data, res);
    } else {
      console.error("❌ Unknown payment type:", data);
      return res.status(400).json({ error: "Unknown payment type" });
    }
  } catch (error) {
    console.error("❌ Error in handleProdamusWebhook:", error);
    return res.status(500).json({ 
      error: "Ошибка обработки платежа", 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Обработка платежа подписки
 */
/** ID плательщика в MongoDB: кастомер платформы или участник клуба (в ссылке оба кладутся в customer_extra, но Prodamus может прислать отдельное поле для клуба). */
function resolveSubscriptionPayerId(data: Record<string, unknown>): string | undefined {
  const raw =
    data.customer_extra ??
    data.club_member_extra ??
    data.clubMember_extra ??
    data.member_extra;
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  return s.length > 0 ? s : undefined;
}

const processSubscriptionPayment = async (data: any, res: Response) => {
  try {
    console.log("📩 Processing subscription payment");

    const payerId = resolveSubscriptionPayerId(data);
    console.log(`Payer ID (platform customer or club member): ${payerId}`);

    if (!payerId) {
      return res.status(400).json({
        error: "Payer id required: customer_extra or club_member_extra (Mongo ObjectId)",
      });
    }

    const subFields = readProdamusSubscription(data);
    if (!subFields) {
      return res.status(400).json({ error: "Missing subscription id (flat or nested subscription object)" });
    }

    const { subscriptionId, activeUser, dateNextPayment } = subFields;

    // Определяем тариф
    let tariff: "basic" | "pro" | "tg_max" | undefined;
    if (subscriptionId === "2473695") tariff = "basic";
    if (subscriptionId === "2474522") tariff = "pro";
    const tgMaxPlatformId = process.env.TG_MAX_SUBSCRIPTION_ID || "2775978";
    const tgMaxClubId = process.env.CLUB_TG_MAX_SUBSCRIPTION_ID;
    if (subscriptionId === String(tgMaxPlatformId) || (tgMaxClubId && subscriptionId === String(tgMaxClubId))) {
      tariff = "tg_max";
    }

    console.log(`Tariff: ${tariff} (subscription id=${subscriptionId})`);

    // Определяем статус
    const status =
      data.payment_status === "success" && String(activeUser ?? "") === "1"
        ? "active"
        : "inactive";

    console.log(`Status: ${status}`);

    // Дата окончания подписки
    const subscriptionEndsAt = dateNextPayment ? new Date(dateNextPayment) : null;

    console.log(`Subscription ends at: ${subscriptionEndsAt}`);

    const payer = await updatePayerSubscription(payerId, {
      tariff,
      subscriptionStatus: status,
      subscriptionEndsAt,
    });

    if (!payer) {
      return res.status(404).json({ error: "Customer or club member not found" });
    }

    const isClub = payer instanceof ClubMember;
    console.log(
      `✅ Subscription updated (${isClub ? "club member" : "platform customer"}): ${payer.username}`
    );

    return res.status(200).json({
      success: true,
      payerType: isClub ? "club_member" : "customer",
      customer: payer,
    });
  } catch (error) {
    console.error("❌ Error in processSubscriptionPayment:", error);
    return res.status(400).json({ error: "Ошибка обновления подписки", details: error });
  }
};

/**
 * Обработка платежа за расклад Таро
 */
const processTarotPayment = async (data: any, res: Response) => {
  try {
    console.log("💳 Processing tarot payment");

    const chatId = data._param_user;
    const customerId = data._param_customer_id;
    const botParam = data._param_bot;
    const username = data._param_username;
    const paymentStatus = data.payment_status;
    const orderId = data.order_num;
    const amount = data.sum;

    console.log(`📝 Payment details: chatId=${chatId}, customerId=${customerId}, status=${paymentStatus}, amount=${amount}, order=${orderId}`);

    // Валидация обязательных параметров
    if (!chatId || !customerId) {
      console.error('❌ Missing required parameters: chatId or customerId');
      return res.status(400).json({ error: "chatId and customerId are required" });
    }

    // Проверка статуса оплаты
    if (paymentStatus !== "success") {
      console.log(`⚠️ Payment not successful: ${paymentStatus}`);
      return res.status(200).json({ success: true, message: "Payment status is not success" });
    }

    // Поиск пользователя и клиента
    const user = await User.findOne({ chat_id: chatId, customerId: customerId });
    
    if (!user) {
      console.error(`❌ User not found: chatId=${chatId}, customerId=${customerId}`);
      return res.status(404).json({ error: "User not found" });
    }

    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      console.error(`❌ Customer not found: ${customerId}`);
      return res.status(404).json({ error: "Customer not found" });
    }

    console.log(`✅ Payment successful for user ${chatId}, customer ${customer.username}`);

    // Сохраняем платеж в БД
    try {
      await Payment.create({
        amount: parseFloat(amount) || 0,
        bot_name: botParam || 'unknown',
        username: username || 'unknown',
        type: 'tarot_reading',
      });
      console.log(`💾 Tarot payment saved to database: ${amount} RUB for chat ${chatId}`);
    } catch (paymentError) {
      console.error("❌ Error saving tarot payment:", paymentError);
      // Продолжаем выполнение, даже если не удалось сохранить платеж
    }

    // Обновляем состояние пользователя
    await User.findOneAndUpdate(
      { chat_id: chatId, customerId: customerId },
      {
        $set: {
          state: 'paid_waiting_question',
          lastPaymentDate: new Date(),
          lastPaymentAmount: parseFloat(amount) || 0
        }
      }
    );

    console.log(`✅ User state updated to 'paid_waiting_question'`);
    
    // Отправляем расклад пользователю
    if (botManager) {
      try {
        await botManager.sendAiLayoutMessage(
          customerId,
          chatId
        );
        
        console.log(`✅ AI layout message sent to chat ${chatId}`);
      } catch (aiError) {
        console.error(`❌ Error sending AI layout message:`, aiError);
        
        // Отправляем уведомление об ошибке пользователю
        const bot = botManager.getBot(customerId);
        if (bot) {
          await bot.telegram.sendMessage(
            chatId,
            "⚠️ Произошла ошибка при генерации расклада. Пожалуйста, свяжитесь с поддержкой. Ваш платеж успешно принят.",
            { parse_mode: 'Markdown' }
          );
        }
      }
    } else {
      console.error('❌ BotManager instance not found');
      return res.status(500).json({ error: "BotManager not available" });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Payment processed successfully",
      data: {
        orderId,
        chatId,
        amount,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("❌ Error in processTarotPayment:", error);
    
    // Пытаемся уведомить пользователя об ошибке, если возможно
    try {
      const chatId = data._param_user;
      const customerId = data._param_customer_id;
      
      if (chatId && customerId && botManager) {
        const bot = botManager.getBot(customerId);
        if (bot) {
          await bot.telegram.sendMessage(
            chatId,
            "❌ Произошла техническая ошибка. Если платеж был списан, но расклад не пришел, свяжитесь с поддержкой.",
            { parse_mode: 'Markdown' }
          );
        }
      }
    } catch (notificationError) {
      console.error("❌ Error sending error notification:", notificationError);
    }
    
    return res
      .status(500)
      .json({ 
        error: "Ошибка обработки платежа", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
  }
};

/**
 * Обработка одноразовой подписки пользователя
 */
const processUserSubscriptionPayment = async (data: any, res: Response) => {
  try {
    const chatId = data._param_user;
    const customerId = data._param_customer_id;
    const botParam = data._param_bot;
    const username = data._param_username;
    const paymentStatus = data.payment_status;
    const amount = parseFloat(data.sum) || 0;
    const orderId = data.order_num;

    console.log(`💎 User subscription payment: chatId=${chatId}, customerId=${customerId}, status=${paymentStatus}, amount=${amount}, order=${orderId}`);

    if (!chatId || !customerId) {
      console.error('❌ Missing required parameters for subscription payment');
      return res.status(400).json({ error: "chatId and customerId are required" });
    }

    if (paymentStatus !== 'success') {
      console.log(`⚠️ Subscription payment not successful: ${paymentStatus}`);
      return res.status(200).json({ success: true, message: "Payment status is not success" });
    }

    let user = await User.findOne({ chat_id: chatId, customerId });

    if (!user) {
      console.warn(`⚠️ User not found for subscription, creating stub: chatId=${chatId}, customerId=${customerId}`);
      user = await User.create({
        chat_id: chatId,
        customerId,
        state: 'step_1'
      });
    }

    const customer = await Customer.findById(customerId);

    if (!customer) {
      console.error(`❌ Customer not found: ${customerId}`);
      return res.status(404).json({ error: "Customer not found" });
    }

    const durationRaw = Number(process.env.USER_SUBSCRIPTION_DURATION_DAYS);
    const durationDays = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 30;
    const now = new Date();
    const baseDate =
      user.subscriptionStatus === 'active' &&
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt > now
        ? user.subscriptionExpiresAt
        : now;

    const newExpiration = new Date(baseDate);
    newExpiration.setDate(newExpiration.getDate() + durationDays);

    await User.findOneAndUpdate(
      { chat_id: chatId, customerId },
      {
        $set: {
          subscriptionStatus: 'active',
          subscriptionExpiresAt: newExpiration,
          lastSubscriptionPaymentAt: now
        }
      }
    );

    try {
      await Payment.create({
        amount,
        bot_name: botParam || 'unknown',
        username: username || 'unknown',
        type: 'user_subscription',
      });
    } catch (paymentError) {
      console.error("❌ Error saving subscription payment:", paymentError);
    }

    const formattedExpiration = newExpiration.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long'
    });

    const bot = botManager.getBot(customerId);
    if (bot) {
      await bot.telegram.sendMessage(
        chatId,
        `💎 Подписка активирована!\n\nДоступ открыт до *${formattedExpiration}*.\n\nМожешь сразу возвращаться в меню — все функции доступны.`,
        { parse_mode: 'Markdown' }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Subscription activated",
      data: {
        orderId,
        chatId,
        customerId,
        expiresAt: newExpiration
      }
    });
  } catch (error) {
    console.error("❌ Error in processUserSubscriptionPayment:", error);
    return res.status(500).json({
      error: "Ошибка обработки подписки",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * @deprecated Используйте handleProdamusWebhook
 * Оставлено для обратной совместимости
 */
export const updateProdamusSubscription = handleProdamusWebhook;

/**
 * @deprecated Используйте handleProdamusWebhook
 * Оставлено для обратной совместимости
 */
export const handleTarotPaymentWebhook = handleProdamusWebhook;
