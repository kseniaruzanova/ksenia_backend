import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../interfaces/authRequest';
import User from '../models/user.model';
import Customer from '../models/customer.model';

/**
 * Получить ID кастомера из запроса или 'admin' если это админ
 */
const getCustomerId = (req: AuthRequest): string | null => {
  if (!req.user) return null;
  
  if (req.user.role === 'admin') {
    return 'admin';
  }
  
  if (req.user.role === 'customer' && req.user.customerId) {
    return req.user.customerId.toString();
  }
  
  return null;
};

/**
 * Получить всех пользователей (без пагинации, для таблицы)
 * GET /api/users/all
 */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  const customerIdOrAdmin = getCustomerId(req);
  
  if (!customerIdOrAdmin) {
    res.status(403).json({ message: 'Forbidden: This action is only for customers and admins.' });
    return;
  }

  try {
    const query: any = {};

    // Основная фильтрация по customerId - ВСЕГДА для кастомеров
    if (customerIdOrAdmin !== 'admin') {
      query.customerId = new mongoose.Types.ObjectId(customerIdOrAdmin);
      console.log(`Customer ${customerIdOrAdmin} requesting all their users`);
    } else {
      console.log('Admin requesting all users from all customers');
    }

    // Получаем всех пользователей без пагинации
    const users = await User.find(query)
      .sort({ createdAt: -1 }) // Сортировка по дате создания (новые первыми)
      .lean()
      .exec();

    console.log(`Found ${users.length} users for ${customerIdOrAdmin === 'admin' ? 'admin' : 'customer ' + customerIdOrAdmin}`);

    // Если админ, группируем пользователей по кастомерам и предоставляем статистику
    if (customerIdOrAdmin === 'admin') {
      const customers = await Customer.find({}).select('_id username').lean();
      const customerMap = new Map(customers.map(c => [c._id.toString(), c.username]));

      const usersByCustomer: { [key: string]: any[] } = {};
      const usersWithoutCustomer: any[] = [];

      for (const user of users) {
        if (user.customerId) {
          const custId = user.customerId.toString();
          const custName = customerMap.get(custId) || custId;
          
          if (!usersByCustomer[custName]) {
            usersByCustomer[custName] = [];
          }
          usersByCustomer[custName].push(user);
        } else {
          usersWithoutCustomer.push(user);
        }
      }

      res.json({
        isAdmin: true,
        allUsers: users,
        totalUsers: users.length,
        totalCustomers: customers.length,
        usersByCustomer,
        usersWithoutCustomer
      });
    } else {
      // Для кастомера просто возвращаем список пользователей
      res.json({
        isAdmin: false,
        users,
        total: users.length
      });
    }
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({ 
      message: 'Error fetching users', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Получить пользователя по chat_id
 * GET /api/users/by-chat-id/:chatId
 */
export const getUserByChatId = async (req: AuthRequest, res: Response) => {
  const customerIdOrAdmin = getCustomerId(req);
  
  if (!customerIdOrAdmin) {
    res.status(403).json({ message: 'Forbidden: This action is only for customers and admins.' });
    return;
  }

  const { chatId } = req.params;

  if (!chatId) {
    res.status(400).json({ message: 'chat_id is required' });
    return;
  }

  try {
    const query: any = { chat_id: chatId };

    // Если это кастомер, фильтруем по customerId
    if (customerIdOrAdmin !== 'admin') {
      query.customerId = new mongoose.Types.ObjectId(customerIdOrAdmin);
    }

    const user = await User.findOne(query).lean();

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Error in getUserByChatId:', error);
    res.status(500).json({ 
      message: 'Error fetching user', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Получить пользователей с пагинацией
 * GET /api/users
 */
export const getUsers = async (req: AuthRequest, res: Response) => {
  const customerIdOrAdmin = getCustomerId(req);
  
  if (!customerIdOrAdmin) {
    res.status(403).json({ message: 'Forbidden: This action is only for customers.' });
    return;
  }

  try {
    const { page = 1, limit = 10, chat_id, state, sortBy } = req.query;

    const query: any = {};

    // Основная фильтрация по customerId - ВСЕГДА для кастомеров
    if (customerIdOrAdmin !== 'admin') {
      query.customerId = new mongoose.Types.ObjectId(customerIdOrAdmin);
      console.log('Customer ObjectId for query:', query.customerId);
    }
    // Админ может видеть всех пользователей всех кастомеров

    // Дополнительные фильтры (опциональные)
    if (chat_id) query.chat_id = chat_id;
    if (state) query.state = state;

    console.log(`Query for ${customerIdOrAdmin === 'admin' ? 'admin' : 'customer ' + customerIdOrAdmin}:`, query);

    // Настройка сортировки
    const sortOptions: any = {};
    if (sortBy === 'recent') {
      sortOptions.updatedAt = -1; // Сначала самые свежие
    } else {
      sortOptions.createdAt = -1; // По умолчанию - сначала новые
    }

    const usersQuery = User.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const users = await usersQuery.exec();
    const count = await User.countDocuments(query);

    console.log(`Found ${count} users for query:`, query);

    res.json({
      users,
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page),
      totalUsers: count,
      isAdmin: customerIdOrAdmin === 'admin'
    });
  } catch (error) {
    console.error('Error in getUsers:', error);
    res.status(500).json({ 
      message: 'Error fetching users', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Создать или обновить пользователя (upsert)
 * POST /api/users/upsert
 */
export const upsertUser = async (req: AuthRequest, res: Response) => {
  const { chat_id, customerId, ...userData } = req.body;

  if (!chat_id || !customerId) {
    res.status(400).json({ message: 'chat_id and customerId are required' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    res.status(400).json({ message: 'Invalid customerId format' });
    return;
  }

  try {
    const user = await User.findOneAndUpdate(
      { chat_id, customerId },
      {
        $set: {
          ...userData,
          chat_id,
          customerId
        },
        $setOnInsert: {
          state: 'new_chat'
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    res.status(200).json({ message: 'User upserted successfully', user });
  } catch (error) {
    console.error('Error during user upsert:', error);
    res.status(500).json({ 
      message: 'Error upserting user', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Обновить поля пользователя
 * PATCH /api/users/:chatId
 */
export const updateUserFields = async (req: AuthRequest, res: Response) => {
  const customerIdOrAdmin = getCustomerId(req);
  
  if (!customerIdOrAdmin) {
    res.status(403).json({ message: 'Forbidden: This action is only for customers and admins.' });
    return;
  }

  const { chatId } = req.params;
  const updateFields = req.body;

  if (!chatId) {
    res.status(400).json({ message: 'chat_id is required' });
    return;
  }

  try {
    const query: any = { chat_id: chatId };

    // Если это кастомер, фильтруем по customerId
    if (customerIdOrAdmin !== 'admin') {
      query.customerId = new mongoose.Types.ObjectId(customerIdOrAdmin);
    }

    const user = await User.findOneAndUpdate(
      query,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user fields:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user fields',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Удалить пользователя
 * DELETE /api/users/:chatId
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  const customerIdOrAdmin = getCustomerId(req);
  
  if (!customerIdOrAdmin) {
    res.status(403).json({ message: 'Forbidden: This action is only for customers and admins.' });
    return;
  }

  const { chatId } = req.params;

  if (!chatId) {
    res.status(400).json({ message: 'chat_id is required' });
    return;
  }

  try {
    const query: any = { chat_id: chatId };

    // Если это кастомер, фильтруем по customerId
    if (customerIdOrAdmin !== 'admin') {
      query.customerId = new mongoose.Types.ObjectId(customerIdOrAdmin);
    }

    const user = await User.findOneAndDelete(query);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

