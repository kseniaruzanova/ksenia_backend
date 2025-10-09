import { Response } from "express";

import Content from "../models/content.model";
import { ContentQuery } from "../interfaces/content";
import { AuthRequest } from "../interfaces/authRequest";

export const getActiveContent = async (req: AuthRequest, res: Response) => {
  const { productType, productId } = req.query;

  if (!productType || !productId) {
    return res.status(400).json({ success: false, message: "productType и productId обязательны" });
  }
  const query: ContentQuery = { 
    productType: productType as string, 
    productId: productId as string,
    isActive: true 
  }
  const content = await Content.findOne(query).sort({ createdAt: -1 }).lean();
  
  if (!content) {
    return res.status(404).json({ success: false, message: "Активный контент для этого продукта не найден" });
  }

  res.json({ success: true, data: content });
};

export const getAllContent = async (req: AuthRequest, res: Response) => {
  const page: number = parseInt(req.query.page as string) || 1;
  const limit: number = parseInt(req.query.limit as string) || 10;
  const skip: number = (page - 1) * limit;

  const filter: ContentQuery = {};
  
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
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
};

export const getContentById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const content = await Content.findById(id);

  if (!content) {
    return res.status(404).json({ success: false, message: "Контент не найден" });
  }

  res.json({ success: true, data: content });
};

export const createContent = async (req: AuthRequest, res: Response) => {
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
    message: "Контент успешно создан",
    data: newContent
  });
};

export const updateContent =async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const content = await Content.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!content) {
    return res.status(404).json({ success: false, message: "Контент не найден" });
  }

  res.json({
    success: true,
    message: "Контент успешно обновлен",
    data: content
  });
};

export const deleteContent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const content = await Content.findByIdAndDelete(id);

  if (!content) {
    return res.status(404).json({ success: false, message: "Контент не найден" });
  }

  res.json({
    success: true,
    message: "Контент успешно удален",
    data: content
  });
};

export const toggleContentActive = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const content = await Content.findById(id);

  if (!content) {
    return res.status(404).json({ success: false, message: "Контент не найден" });
  }

  content.isActive = !content.isActive;
  await content.save();

  res.json({
    success: true,
    message: `Контент ${content.isActive ? "активирован" : "деактивирован"}`,
    data: content
  });
};
