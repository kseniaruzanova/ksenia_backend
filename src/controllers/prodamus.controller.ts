import { Request,Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { createProdamusPayLink } from '../services/prodamus.service';
import Customer from '../models/customer.model';

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
            urlSuccess: "https://botprorok.ru/"
        });

        res.json({
            message: 'Customer profile data',
            link: link
        });
    } catch (error) {
        console.error('Error getting customer profile:', error);
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
            urlReturn: "https://botprorok.ru/",
            urlSuccess: "https://botprorok.ru/"
        });

        res.json({
            message: 'Customer profile data',
            link: link
        });
    } catch (error) {
        console.error('Error getting customer profile:', error);
        res.status(500).json({ message: 'Error fetching profile', error });
    }
};

// {
//   "date": "2025-08-28T10:45:23+03:00",
//   "order_id": "35237330",
//   "order_num": "",
//   "domain": "astroxenia.payform.ru",
//   "sum": "4900.00",
//   "currency": "rub",
//   "customer_phone": "+375259997565",
//   "customer_email": "toqoko@gmail.com",
//   "customer_extra": "685460413768f47bc4da16ed",
//   "payment_type": "Оплата картой, выпущенной в РФ",
//   "commission": "3.5",
//   "commission_sum": "171.50",
//   "attempt": "1",
//   "products[0][name]": "Тариф базовый Sistema ",
//   "products[0][price]": "4900.00",
//   "products[0][quantity]": "1",
//   "products[0][sum]": "4900.00",
//   "subscription[id]": "2473695",
//   "subscription[profile_id]": "1063347",
//   "subscription[demo]": "1",
//   "subscription[active_manager]": "1",
//   "subscription[active_manager_date]": "",
//   "subscription[active_user]": "1",
//   "subscription[active_user_date]": "",
//   "subscription[cost]": "4900.00",
//   "subscription[currency]": "rub",
//   "subscription[name]": "Тариф базовый Sistema ",
//   "subscription[limit_autopayments]": "",
//   "subscription[autopayments_num]": "0",
//   "subscription[first_payment_discount]": "0.00",
//   "subscription[next_payment_discount]": "0.00",
//   "subscription[next_payment_discount_num]": "",
//   "subscription[date_create]": "2025-08-28 10:44:14",
//   "subscription[date_first_payment]": "2025-08-28 10:44:14",
//   "subscription[date_last_payment]": "2025-08-28 10:44:14",
//   "subscription[date_next_payment]": "2025-09-27 10:44:14",
//   "subscription[date_next_payment_discount]": "2025-08-28 10:44:14",
//   "subscription[date_completion]": "",
//   "subscription[payment_num]": "1",
//   "subscription[notification]": "0",
//   "subscription[process_started_at]": "",
//   "subscription[autopayment]": "0",
//   "maskedPan": "546998******8525",
//   "payment_status": "success",
//   "payment_status_description": "Успешная оплата",
//   "payment_init": "manual"
// }

export const updateProdamus = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    console.log("📩 Prodamus webhook:", JSON.stringify(data, null, 2));

    const customerId = data.customer_extra;
    console.log(customerId)
    if (!customerId) {
      return res.status(400).json({ error: "customer_extra is required" });
    }

    // Определяем тариф
    let tariff: "basic" | "pro" | undefined;
    if (String(data["subscription[id]"]) === "2473695") tariff = "basic";
    if (String(data["subscription[id]"]) === "2474522") tariff = "pro";

    console.log(tariff)

    // Определяем статус
    const status =
      data.payment_status === "success" && data["subscription[active_user]"] === "1"
        ? "active"
        : "inactive";

    console.log(status)

    // Дата окончания подписки
    const subscriptionEndsAt = data["subscription[date_next_payment]"]
      ? new Date(data["subscription[date_next_payment]"])
      : null;

    console.log(subscriptionEndsAt)

    // Обновляем пользователя
    const customer = await Customer.findByIdAndUpdate(
      customerId,
      {
        $set: {
          tariff,
          subscriptionStatus: status,
          subscriptionEndsAt,
          currentPrice: data["subscription[cost]"]
            ? Number(data["subscription[cost]"])
            : undefined,
          basePrice: data.sum ? Number(data.sum) : undefined,
          cardNumber: data.maskedPan || undefined,
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
    console.error("❌ Error in updateProdamus:", error);
    return res
      .status(400)
      .json({ error: "Ошибка обновления подписки", details: error });
  }
};
