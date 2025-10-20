import { Request, Response } from "express";

import { AuthRequest } from "../interfaces/authRequest";
import { createProdamusPayLink } from "../utils/prodamus";
import User from "../models/user.model";
import Customer from "../models/customer.model";
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

/**
 * Универсальный webhook для обработки всех типов платежей от Prodamus
 * Определяет тип платежа и вызывает соответствующую логику
 */
export const handleProdamusWebhook = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    console.log("📩 Prodamus webhook received:", JSON.stringify(data, null, 2));

    // Определяем тип платежа по наличию специфических полей
    const isSubscription = data["subscription[id]"] !== undefined;
    const isTarotPayment = data._param_user !== undefined && data._param_customer_id !== undefined;

    console.log(`🔍 Payment type detection: subscription=${isSubscription}, tarot=${isTarotPayment}`);

    if (isSubscription) {
      console.log("🔄 Processing as subscription payment");
      return await processSubscriptionPayment(data, res);
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
const processSubscriptionPayment = async (data: any, res: Response) => {
  try {
    console.log("📩 Processing subscription payment");

    const customerId = data.customer_extra;
    console.log(`Customer ID: ${customerId}`);
    
    if (!customerId) {
      return res.status(400).json({ error: "customer_extra is required" });
    }

    // Определяем тариф
    let tariff: "basic" | "pro" | undefined;
    if (String(data["subscription[id]"]) === "2473695") tariff = "basic";
    if (String(data["subscription[id]"]) === "2474522") tariff = "pro";

    console.log(`Tariff: ${tariff}`);

    // Определяем статус
    const status =
      data.payment_status === "success" && data["subscription[active_user]"] === "1"
        ? "active"
        : "inactive";

    console.log(`Status: ${status}`);

    // Дата окончания подписки
    const subscriptionEndsAt = data["subscription[date_next_payment]"]
      ? new Date(data["subscription[date_next_payment]"])
      : null;

    console.log(`Subscription ends at: ${subscriptionEndsAt}`);

    // Обновляем пользователя
    const customer = await Customer.findByIdAndUpdate(
      customerId,
      {
        $set: {
          tariff,
          subscriptionStatus: status,
          subscriptionEndsAt,
        },
      },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    console.log(`✅ Customer subscription updated: ${customer.username}`);

    return res.status(200).json({ success: true, customer });
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
 * @deprecated Используйте handleProdamusWebhook
 * Оставлено для обратной совместимости
 */
export const updateProdamusSubscription = handleProdamusWebhook;

/**
 * @deprecated Используйте handleProdamusWebhook
 * Оставлено для обратной совместимости
 */
export const handleTarotPaymentWebhook = handleProdamusWebhook;
