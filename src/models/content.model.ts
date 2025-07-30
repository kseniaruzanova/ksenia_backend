import { Schema, model, Document } from 'mongoose';

export interface IContent extends Document {
  title: string;
  description: string;
  content: string; // Markdown content
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contentSchema = new Schema<IContent>({
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

// Индекс для быстрого поиска активного контента
contentSchema.index({ isActive: 1 });

const Content = model<IContent>('Content', contentSchema);

export default Content;