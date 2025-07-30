import { Schema, model, Document } from 'mongoose';

export interface IContent extends Document {
  productType: string;
  productId: string;
  title: string;
  description: string;
  content: string; // Markdown content
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contentSchema = new Schema<IContent>({
  productType: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  productId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 500
  },
  content: { 
    type: String, 
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
});

// Индекс для быстрого поиска активного контента для конкретного продукта
contentSchema.index({ productType: 1, productId: 1, isActive: 1 });

const Content = model<IContent>('Content', contentSchema);

export default Content;