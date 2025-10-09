import mongoose from "mongoose";

import Payment from "../models/payment.model";
import User from "../models/user.model";
import Customer from "../models/customer.model";

export class StatisticsService {
  async getGeneralStatsPerUser(username: string) {
    // Параллельное выполнение запросов
    const [paymentsCount, paymentsSum] = await Promise.all([
      Payment.countDocuments({ username }),
      Payment.aggregate([
        { $match: { username } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    return {
      paymentsCount,
      paymentsSum: paymentsSum[0]?.total || 0
    };
  }

  async getGeneralStatsForAdmin() {
    // Параллельное выполнение запросов
    const [paymentsCount, paymentsSum] = await Promise.all([
      Payment.countDocuments(),
      Payment.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    return {
      paymentsCount,
      paymentsSum: paymentsSum[0]?.total || 0
    };
  }

  async getStatUsers(customerIdOrAdmin: string | number) {
    if (!customerIdOrAdmin) {
      throw new Error('Forbidden: This action is only for customers and admins.');
    }

    try {
      const isAdmin = customerIdOrAdmin === 'admin';
      const query: any = {};
      
      // Основная фильтрация по customerId
      if (!isAdmin) {
        query.customerId = new mongoose.Types.ObjectId(customerIdOrAdmin as string);
      }

      // Оптимизированный запрос с проекцией только нужных полей
      const users = await User.find(query)
        .select('chat_id state customerId createdAt') // Только необходимые поля
        .sort({ createdAt: -1 })
        .lean() // Используем lean для лучшей производительности
        .exec();

      // Для админа получаем дополнительную информацию
      if (isAdmin) {
        return await this.getAdminUserStats(users);
      } else {
        return {
          message: 'All users data for customer',
          isAdmin: false,
          customerId: customerIdOrAdmin,
          totalUsers: users.length,
          users
        };
      }
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw new Error('Error in getAllUsers:');
    }
  }

  private async getAdminUserStats(users: any[]) {
    // Параллельное получение данных о кастомерах
    const [Customer, usersWithoutCustomer, usersByCustomer] = await Promise.all([
      this.getCustomersData(),
      this.findUsersWithoutCustomer(users),
      this.groupUsersByCustomer(users)
    ]);

    return {
      message: 'All users data for admin',
      isAdmin: true,
      totalUsers: users.length,
      totalCustomers: Object.keys(usersByCustomer).length,
      usersWithoutCustomer: usersWithoutCustomer.length > 0 ? usersWithoutCustomer : undefined,
      usersByCustomer,
      users,
      allUsers: users
    };
  }

  private async getCustomersData() {
    try {
      return await Customer.find({}, 'username _id').lean().exec();
    } catch (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
  }

  private async findUsersWithoutCustomer(users: any[]) {
    return users.filter(user => !user.customerId);
  }

  private async groupUsersByCustomer(users: any[]) {
    const customers = await Customer.find({}, 'username _id').lean().exec();
    
    // Создаем Map для быстрого поиска
    const customerMap = new Map(
      customers.map(customer => [customer._id.toString(), customer.username])
    );

    const usersByCustomer: any = {};

    users.forEach(user => {
      if (!user.customerId) return;

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

    return usersByCustomer;
  }

  // Дополнительные оптимизации для больших наборов данных
  async getStatUsersPaginated(
    customerIdOrAdmin: string | number, 
    page: number = 1, 
    limit: number = 50
  ) {
    if (!customerIdOrAdmin) {
      throw new Error('Forbidden: This action is only for customers and admins.');
    }

    const isAdmin = customerIdOrAdmin === 'admin';
    const query: any = {};
    
    if (!isAdmin) {
      query.customerId = new mongoose.Types.ObjectId(customerIdOrAdmin as string);
    }

    const skip = (page - 1) * limit;

    // Параллельное выполнение запросов для пагинации
    const [users, totalUsers] = await Promise.all([
      User.find(query)
        .select('chat_id state customerId createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      User.countDocuments(query)
    ]);

    if (isAdmin) {
      const usersByCustomer = await this.groupUsersByCustomer(users);
      
      return {
        message: 'Paginated users data for admin',
        isAdmin: true,
        users,
        usersByCustomer,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasNext: page < Math.ceil(totalUsers / limit),
          hasPrev: page > 1
        }
      };
    } else {
      return {
        message: 'Paginated users data for customer',
        isAdmin: false,
        customerId: customerIdOrAdmin,
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasNext: page < Math.ceil(totalUsers / limit),
          hasPrev: page > 1
        }
      };
    }
  }
}

const statisticsService = new StatisticsService();
export default statisticsService;
