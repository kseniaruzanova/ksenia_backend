import { Request, Response } from 'express';
import ProductRequest from '../models/productRequest.model';
import { AppError } from '../interfaces/appError';

// Функция для сохранения запроса продукта
export const trackProductRequest = async (
  productType: 'forecast' | 'financialCast' | 'mistakesIncarnation' | 'arcanumRealization' | 'awakeningCodes' | 'matrixLife' | 'karmicTail',
  customerId: string,
  birthDate: string,
  requestType: 'pdf' | 'json'
) => {
  try {
    const result = await ProductRequest.create({
      productType,
      customerId,
      birthDate,
      requestType
    });
    console.log(`✅ Tracked ${productType} request (${requestType}) for customer ${customerId}`);
    return result;
  } catch (error) {
    console.error('❌ Error tracking product request:', {
      productType,
      customerId,
      birthDate,
      requestType,
      error: error instanceof Error ? error.message : error
    });
  }
};

// Получить общую статистику по всем продуктам
export const getProductStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await ProductRequest.aggregate([
      {
        $group: {
          _id: '$productType',
          totalRequests: { $sum: 1 },
          pdfRequests: {
            $sum: { $cond: [{ $eq: ['$requestType', 'pdf'] }, 1, 0] }
          },
          jsonRequests: {
            $sum: { $cond: [{ $eq: ['$requestType', 'json'] }, 1, 0] }
          },
          lastRequest: { $max: '$createdAt' }
        }
      },
      {
        $sort: { totalRequests: -1 }
      }
    ]);

    // Добавляем нулевые значения для продуктов без запросов
    const allProducts = ['forecast', 'financialCast', 'mistakesIncarnation', 'arcanumRealization', 'awakeningCodes', 'matrixLife', 'karmicTail'];
    const productMap = new Map(statistics.map(stat => [stat._id, stat]));
    
    const completeStatistics = allProducts.map(product => {
      const stat = productMap.get(product);
      return {
        productType: product,
        totalRequests: stat?.totalRequests || 0,
        pdfRequests: stat?.pdfRequests || 0,
        jsonRequests: stat?.jsonRequests || 0,
        lastRequest: stat?.lastRequest || null
      };
    });

    res.status(200).json({
      status: 'success',
      data: completeStatistics
    });
  } catch (error) {
    throw new AppError('Error fetching product statistics', 500);
  }
};

// Получить детальную статистику по конкретному продукту
export const getProductDetailedStatistics = async (req: Request, res: Response) => {
  const { productType } = req.params;

  try {
    const totalRequests = await ProductRequest.countDocuments({ productType });
    
    const requestsByCustomer = await ProductRequest.aggregate([
      { $match: { productType } },
      {
        $group: {
          _id: '$customerId',
          requestCount: { $sum: 1 },
          lastRequest: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $unwind: '$customer'
      },
      {
        $project: {
          customerId: '$_id',
          customerUsername: '$customer.username',
          requestCount: 1,
          lastRequest: 1
        }
      },
      {
        $sort: { requestCount: -1 }
      }
    ]);

    const requestsByDay = await ProductRequest.aggregate([
      { $match: { productType } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: -1 }
      },
      {
        $limit: 30 // Последние 30 дней
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        productType,
        totalRequests,
        requestsByCustomer,
        requestsByDay
      }
    });
  } catch (error) {
    throw new AppError('Error fetching detailed product statistics', 500);
  }
};

// Получить статистику запросов по периоду
export const getProductStatisticsByPeriod = async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  try {
    const matchFilter: any = {};
    
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate as string);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate as string);
    }

    const statistics = await ProductRequest.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$productType',
          totalRequests: { $sum: 1 },
          pdfRequests: {
            $sum: { $cond: [{ $eq: ['$requestType', 'pdf'] }, 1, 0] }
          },
          jsonRequests: {
            $sum: { $cond: [{ $eq: ['$requestType', 'json'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { totalRequests: -1 }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        period: { startDate: startDate || 'all', endDate: endDate || 'now' },
        statistics
      }
    });
  } catch (error) {
    throw new AppError('Error fetching statistics by period', 500);
  }
};

