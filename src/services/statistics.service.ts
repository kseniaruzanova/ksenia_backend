import { log } from 'console';
import Payment, { IPayment } from '../models/payment.model';
import User from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';
import mongoose from 'mongoose';

export class StatisticsService {
  async getGeneralStatsPerUser(username: string) {

   // const usersCount = await User.countDocuments();
    const paymentsCount = await Payment.countDocuments({
      username: username
    });
    const paymentsSum = await Payment.aggregate([
      { $match: { username } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);



    return {
      paymentsCount,
      paymentsSum: paymentsSum[0]?.total || 0
    };
  }

  async getGeneralStatsForAdmin() {
  //  const usersCount = await User.countDocuments();
    const paymentsCount = await Payment.countDocuments();
    const paymentsSum = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return {
    //  usersCount,
      paymentsCount,
      paymentsSum: paymentsSum[0]?.total || 0
    };
  }

  async getStatUsers(customerIdOrAdmin: string | number) {

    if (!customerIdOrAdmin) {
      throw new Error( 'Forbidden: This action is only for customers and admins.');
    }

    try {
      const query: any = {};
      // Основная фильтрация по customerId - ВСЕГДА для кастомеров
      if (customerIdOrAdmin !== 'admin') {
         query.customerId = new mongoose.Types.ObjectId(customerIdOrAdmin);;
        console.log(`Customer ${customerIdOrAdmin} requesting all their users`);
      } else {
        console.log('Admin requesting all users from all customers');
      }

      // Получаем всех пользователей без пагинации
      const users = await User.find(query)
        .sort({ createdAt: -1 }) // Сортировка по дате создания (новые первыми)
        .exec();

      console.log(`Found ${users.length} users for ${customerIdOrAdmin === 'admin' ? 'admin' : 'customer ' + customerIdOrAdmin}`);

      // Если админ, группируем пользователей по кастомерам для удобства
      if (customerIdOrAdmin === 'admin') {
        // Получаем информацию о кастомерах
        const Customer = require('../models/customer.model').default;
        const customers = await Customer.find({}, 'username _id');

        console.log(`Found ${customers.length} customers in database`);

        // Создаем мапу кастомеров
        const customerMap = new Map();
        customers.forEach((customer: any) => {
          customerMap.set(customer._id.toString(), customer.username);
        });

        // Группируем пользователей по кастомерам
        const usersByCustomer: any = {};
        const usersWithoutCustomer: any[] = [];

        users.forEach((user, index) => {
          // Проверяем что customerId существует
          if (!user.customerId) {
            console.warn(`User ${user.chat_id || `at index ${index}`} has no customerId. User data:`, {
              chat_id: user.chat_id,
              state: user.state,
              customerId: user.customerId,
              _id: user._id
            });
            usersWithoutCustomer.push(user);
            return;
          }

          const customerId = user.customerId.toString();
          const customerName = customerMap.get(customerId) || 'Unknown Customer';

          if (!usersByCustomer[customerId]) {
            usersByCustomer[customerId] = {
              customerId,
              customerName,
              users: []
            };
          }
          usersByCustomer[customerId].users.push(user);
        });

        console.log(`Grouped users: ${Object.keys(usersByCustomer).length} customers, ${usersWithoutCustomer.length} users without customerId`);

        return {
          message: 'All users data for admin',
          isAdmin: true,
          totalUsers: users.length,
          totalCustomers: Object.keys(usersByCustomer).length,
          usersWithoutCustomer: usersWithoutCustomer.length > 0 ? usersWithoutCustomer : undefined,
          usersByCustomer,
          users,
          allUsers: users // Также возвращаем плоский список
        }
      } else {
        // Для кастомера просто возвращаем его пользователей
        return  {
          message: 'All users data for customer',
          isAdmin: false,
          customerId: customerIdOrAdmin,
          totalUsers: users.length,
          users
        }
      }
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw new Error('Error in getAllUsers:');
    }
}
}

export default new StatisticsService();
