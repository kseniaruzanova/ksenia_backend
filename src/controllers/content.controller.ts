import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Content from '../models/content.model';
import { catchAsync } from '../lib/catchAsync';

// ... (остальные функции без изменений)

// Получить активный контент для конкретного продукта
export const getActiveContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { productType, productId } = req.query;

  console.log(`[Content] Поиск активного контента для productType: "${productType}", productId: "${productId}"`);

  if (!productType || !productId) {
    console.log('[Content] Ошибка: productType или productId не предоставлены.');
    return res.status(400).json({ success: false, message: 'productType и productId обязательны' });
  }

  const query = { 
    productType: productType as string, 
    productId: productId as string,
    isActive: true 
  };

  console.log('[Content] Запрос к базе данных:', query);

  const content = await Content.findOne(query)
    .sort({ createdAt: -1 })
    .lean();
  
  if (!content) {
    console.log('[Content] Контент не найден в базе данных.');
    return res.status(404).json({ success: false, message: 'Активный контент для этого продукта не найден' });
  }

  console.log('[Content] Контент успешно найден:', content._id);
  res.json({ success: true, data: content });
});

// ... (остальные функции без изменений)

// Я оставлю остальные функции без изменений, так как они не затрагиваются напрямую
// Но для полноты картины, вот их реализация с сохранением структуры файла

export const getAllContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};
  
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }
  if (req.query.productType) {
    filter.productType = req.query.productType as string;
  }
  if (req.query.productId) {
    filter.productId = req.query.productId as string;
  }

  const [content, total] = await Promise.all([
    Content.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Content.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: content,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

export const getContentById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const content = await Content.findById(id);

  if (!content) {
    return res.status(404).json({ success: false, message: 'Контент не найден' });
  }

  res.json({ success: true, data: content });
});

export const createContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { productType, productId, title, description, content, isActive } = req.body;

  const newContent = new Content({
    productType,
    productId,
    title,
    description,
    content,
    isActive: isActive !== undefined ? isActive : true
  });

  await newContent.save();

  res.status(201).json({
    success: true,
    message: 'Контент успешно создан',
    data: newContent
  });
});

export const updateContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const content = await Content.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!content) {
    return res.status(404).json({ success: false, message: 'Контент не найден' });
  }

  res.json({
    success: true,
    message: 'Контент успешно обновлен',
    data: content
  });
});

export const deleteContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const content = await Content.findByIdAndDelete(id);

  if (!content) {
    return res.status(404).json({ success: false, message: 'Контент не найден' });
  }

  res.json({
    success: true,
    message: 'Контент успешно удален',
    data: content
  });
});

export const toggleContentActive = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const content = await Content.findById(id);

  if (!content) {
    return res.status(404).json({ success: false, message: 'Контент не найден' });
  }

  content.isActive = !content.isActive;
  await content.save();

  res.json({
    success: true,
    message: `Контент ${content.isActive ? 'активирован' : 'деактивирован'}`,
    data: content
  });
});