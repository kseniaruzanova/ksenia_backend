import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import StatisticsService from '../services/statistics.service';
import { getCustomerId } from './users.controller';


export const getGeneralStats = async (req: AuthRequest, res: Response) => {
  const customerIdOrAdmin = getCustomerId(req);
  const user = req.user;
  if (!customerIdOrAdmin) {
    res.status(403).json({ message: 'Forbidden: This action is only for customers and admins.' });
    return;
  }
  try {
    let stats = {};
    if (customerIdOrAdmin === 'admin') {
      stats = await StatisticsService.getGeneralStatsForAdmin();
    } else {
      stats = await StatisticsService.getGeneralStatsPerUser(user?.username ?? '');
    }
    const userStats = await StatisticsService.getStatUsers(customerIdOrAdmin);
    res.status(201).json({
      ...stats,
      ...userStats
    });
  } catch (error) {
    res.status(400).json({error: 'Ошибка создания платежа', details: error});
  }
};
