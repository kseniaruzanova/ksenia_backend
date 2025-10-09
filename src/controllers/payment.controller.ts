import { Request, Response } from 'express';
import { AuthRequest } from '../interfaces/authRequest';
import { PaymentQueryParams } from '../interfaces/payment';
import paymentService from '../services/payment.service';

// @TODO
// export const createPayment = async (req: Request, res: Response) => {
//   const {amount = null, bot_name = null, username = null, type = null} = req.body;

//   if (
//     typeof amount !== 'number' ||
//     !bot_name ||
//     !username ||
//     !type
//   ) {
//     res.status(400).json({error: 'Поля amount, bot_name, username, type обязательны и должны быть корректными.'});
//   }

//   try {
//     const payment = await paymentService.create({amount, bot_name, username, type});
//     res.status(201).json(payment);
//   } catch (error) {
//     res.status(400).json({error: 'Ошибка создания платежа', details: error});
//   }
// };

export const getPaymentsPaginated = async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '10', filters = '{}' } = req.query;
  const user = req.user;

  try {
    const parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : {};
    
    const result = await paymentService.findAllPaginated(
      Number(page),
      Number(limit),
      parsedFilters,
      user
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения платежей', details: error });
  }
};

export const getPaymentsByUsernamePaginated = async (req: AuthRequest, res: Response) => {
  const { username } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const user = req.user;

  if (!username) {
    return res.status(400).json({ error: 'Не указан username' });
  }

  try {
    const result = await paymentService.findByUsernamePaginated(
      username, 
      Number(page), 
      Number(limit),
      user
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения платежей по username', details: error });
  }
};
