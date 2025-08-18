import { Schema, model, Document, Types } from 'mongoose';

export type MessageType = 
  | 'text' 
  | 'photo' 
  | 'video' 
  | 'document' 
  | 'audio' 
  | 'voice' 
  | 'sticker'
  | 'location'
  | 'contact'
  | 'poll'
  | 'dice'
  | 'system';

export type MessageStatus = 
  | 'sending' 
  | 'sent' 
  | 'delivered' 
  | 'read' 
  | 'failed';

export interface IMessageContent {
  text?: string;
  caption?: string;
  fileId?: string;
  fileIds?: string[];
  // Другие специфичные поля для разных типов
}

export interface IMessage extends Document {
  chatId: Types.ObjectId;     // Ссылка на чат
  customerId: Types.ObjectId; // Дублируем для быстрого поиска
  messageId: string;          // Telegram message ID
  type: MessageType;
  direction: 'in' | 'out';
  content: IMessageContent;
  status: MessageStatus;
  timestamp: Date;
}

const MessageContentSchema = new Schema<IMessageContent>({
  text: { type: String },
  caption: { type: String },
  fileId: { type: String },
  fileIds: { type: [String] }
}, { _id: false, strict: false }); // strict: false позволяет добавлять другие поля динамически

const MessageSchema = new Schema<IMessage>({
  chatId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Chat', 
    required: true 
  },
  customerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  messageId: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: [
      'text', 'photo', 'video', 'document', 'audio', 
      'voice', 'sticker', 'location', 'contact', 
      'poll', 'dice', 'system'
    ], 
    required: true 
  },
  direction: { 
    type: String, 
    enum: ['in', 'out'], 
    required: true 
  },
  content: { 
    type: MessageContentSchema, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'], 
    default: 'sent' 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
}, {
  collection: 'Messages'
});

// Индексы для быстрого поиска сообщений
MessageSchema.index({ chatId: 1, timestamp: 1 });
MessageSchema.index({ customerId: 1, timestamp: 1 });
MessageSchema.index({ messageId: 1 }, { unique: true });

export const Message = model<IMessage>('Message', MessageSchema);
