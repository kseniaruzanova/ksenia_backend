import { Schema, model, Document, Types } from 'mongoose';

export interface IChatMeta {
  firstName?: string;
  lastName?: string;
  username?: string;
  lastMessageAt?: Date;
  unreadCount?: number;
  // Дополнительные мета-поля по необходимости
}

export interface IChat extends Document {
  customerId: Types.ObjectId; // Ссылка на владельца бота
  chatId: string;             // Telegram chat ID
  userId: string;             // Telegram user ID
  status: 'active' | 'archived' | 'blocked';
  meta: IChatMeta;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMetaSchema = new Schema<IChatMeta>({
  firstName: { type: String },
  lastName: { type: String },
  username: { type: String },
  lastMessageAt: { type: Date },
  unreadCount: { type: Number, default: 0 }
}, { _id: false });

const ChatSchema = new Schema<IChat>({
  customerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  chatId: { 
    type: String, 
    required: true 
  },
  userId: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'archived', 'blocked'], 
    default: 'active' 
  },
  meta: { 
    type: ChatMetaSchema, 
    default: {} 
  }
}, {
  timestamps: true,
  collection: 'Chats'
});

// Составной индекс для быстрого поиска чатов
ChatSchema.index({ customerId: 1, chatId: 1 }, { unique: true });
// Индекс для сортировки чатов по последнему сообщению
ChatSchema.index({ customerId: 1, 'meta.lastMessageAt': -1 });

export const Chat = model<IChat>('Chat', ChatSchema);