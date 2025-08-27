import { Request,Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { createProdamusPayLink } from '../services/prodamus.service';

export const getLinkProdamusBasic = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { user } = req;
        
        // Проверяем что это кастомер
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
        
        // Проверяем что это кастомер
        if (!user || user.role !== 'customer' || !user.customerId) {
            res.status(403).json({ message: 'Forbidden: Only customers can access their profile' });
            return;
        }

        const link = createProdamusPayLink("astroxenia", {
            customer_extra: user.customerId, // твой ID пользователя
            subscription: 2474522,                    // включаем подписку
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

export const updateProdamus = async (req: Request, res: Response) => {
  const {amount = null, type = null} = req.body;

  if (
    typeof amount !== 'number' || !type
  ) {
    res.status(400).json({error: 'Поля amount, bot_name, username, type обязательны и должны быть корректными.'});
  }

  try {
    console.log("It wokr")
    console.log(type)
    res.status(201).json({});
  } catch (error) {
    res.status(400).json({error: 'Ошибка создания платежа', details: error});
  }
};
