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
            urlSuccess: "https://botprorok.ru/notification/success"
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
            urlReturn: "https://botprorok.ru",
            urlSuccess: "https://botprorok.ru/notification/success"
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
