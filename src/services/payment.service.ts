import Payment, { IPayment } from "../models/payment.model";

export class PaymentService {
  async create(data: Partial<IPayment>): Promise<IPayment> {
    const payment = new Payment(data);
    return payment.save();
  }

  async findById(id: string): Promise<IPayment | null> {
    return Payment.findById(id).exec();
  }

  async findAllPaginated(
    page = 1,
    limit = 10,
    filters: Record<string, unknown> = {},
    user?: { username: string; role: 'admin' | 'customer' }
  ): Promise<{ payments: IPayment[]; total: number; totalPages: number; currentPage: number }> {
    const skip = (Number(page) - 1) * Number(limit);

    const query: Record<string, any> = {};

    // Если пользователь не админ, показываем только его платежи
    if (user && user.role !== 'admin') {
      query.username = user.username;
    }

    // Применяем дополнительные фильтры
    for (const [key, value] of Object.entries(filters)) {
      const field = key;

      if (field === 'fromDate' || field === 'toDate') {
        query.createdAt ??= {};

        if (field === 'fromDate') {
          query.createdAt.$gte = new Date(value as string);
        }

        if (field === 'toDate') {
          query.createdAt.$lte = new Date(value as string);
        }
      } else if (value !== undefined && value !== null && value !== '') {
        // Добавляем только если значение не пустое
        query[field] = value;
      }
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .exec();

    const total = await Payment.countDocuments(query);
    return {
      payments,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page)
    };
  }

  async findByUsernamePaginated(
    username: string, 
    page = 1, 
    limit = 10,
    user?: { username: string; role: 'admin' | 'customer' }
  ): Promise<{ payments: IPayment[]; total: number; totalPages: number; currentPage: number }> {
    
    // Проверяем права доступа
    if (user && user.role !== 'admin' && user.username !== username) {
      throw new Error('Access denied');
    }

    const skip = (Number(page) - 1) * Number(limit);
    const payments = await Payment.find({ username })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .exec();
    const total = await Payment.countDocuments({ username });
    return {
      payments,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page)
    };
  }

  async update(id: string, data: Partial<IPayment>): Promise<IPayment | null> {
    return Payment.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<IPayment | null> {
    return Payment.findByIdAndDelete(id).exec();
  }

  async findByUsername(
    username: string,
    user?: { username: string; role: 'admin' | 'customer' }
  ): Promise<IPayment[]> {
    // Проверяем права доступа
    if (user && user.role !== 'admin' && user.username !== username) {
      throw new Error('Access denied');
    }

    return Payment.find({ username }).exec();
  }
}

export default new PaymentService();
