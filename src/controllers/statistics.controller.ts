import { Response } from "express";

import { getCustomerId } from "../utils/customers";
import { AuthRequest } from "../interfaces/authRequest";
import StatisticsService from "../services/statistics.service";

export const getGeneralStats = async (req: AuthRequest, res: Response) => {
  const customerIdOrAdmin = getCustomerId(req);
  const user = req.user;
  
  if (!customerIdOrAdmin) {
    return res.status(403).json({ 
      message: 'Forbidden: This action is only for customers and admins.' 
    });
  }

  try {
    const [stats, userStats] = await Promise.all([
      customerIdOrAdmin === 'admin' 
        ? StatisticsService.getGeneralStatsForAdmin()
        : StatisticsService.getGeneralStatsPerUser(user?.username ?? ''),
      StatisticsService.getStatUsers(customerIdOrAdmin)
    ]);

    return res.status(200).json({
      ...stats,
      ...userStats
    });

  } catch (error) {
    console.error('Error in getGeneralStats:', error);
    return res.status(400).json({
      error: 'Ошибка получения статистики',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
