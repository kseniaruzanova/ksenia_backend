import { log } from 'console';
import Payment, { IPayment } from '../models/payment.model';
import User from '../models/user.model';

export class StatisticsService {
  async getGeneralStatsPerUser(customerId) {

    const usersCount = await User.countDocuments();
    const paymentsCount = await Payment.countDocuments();
    const paymentsSum = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return {
      usersCount,
      paymentsCount,
      paymentsSum: paymentsSum[0]?.total || 0
    };
  }

  async getGeneralStatsForAdmin() {
    const usersCount = await User.countDocuments();
    const paymentsCount = await Payment.countDocuments();
    const paymentsSum = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return {
      usersCount,
      paymentsCount,
      paymentsSum: paymentsSum[0]?.total || 0
    };
  }
}

export default new StatisticsService();
