import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Content from '../models/content.model';
import { catchAsync } from '../lib/catchAsync';

// Получить весь контент (с пагинацией)
export const getAllContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};
  
  // Фильтр по активности (опционально)
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
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

// Получить контент по ID
export const getContentById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const content = await Content.findById(id);

  if (!content) {
    res.status(404).json({
      success: false,
      message: 'Контент не найден'
    });
    return;
  }

  res.json({
    success: true,
    data: content
  });
});

// Получить активный контент (для публичного использования)
export const getActiveContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const content = await Content.find({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: content
  });
});

// Создать новый контент
export const createContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { title, description, content, isActive } = req.body;

  const newContent = new Content({
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

// Обновить контент
export const updateContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const content = await Content.findByIdAndUpdate(
    id,
    updateData,
    { 
      new: true, 
      runValidators: true 
    }
  );

  if (!content) {
    res.status(404).json({
      success: false,
      message: 'Контент не найден'
    });
    return;
  }

  res.json({
    success: true,
    message: 'Контент успешно обновлен',
    data: content
  });
});

// Удалить контент
export const deleteContent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const content = await Content.findByIdAndDelete(id);

  if (!content) {
    res.status(404).json({
      success: false,
      message: 'Контент не найден'
    });
    return;
  }

  res.json({
    success: true,
    message: 'Контент успешно удален',
    data: content
  });
});

// Переключить активность контента
export const toggleContentActive = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const content = await Content.findById(id);

  if (!content) {
    res.status(404).json({
      success: false,
      message: 'Контент не найден'
    });
    return;
  }

  content.isActive = !content.isActive;
  await content.save();

  res.json({
    success: true,
    message: `Контент ${content.isActive ? 'активирован' : 'деактивирован'}`,
    data: content
  });
});