import { Schema, model, Document, Types } from 'mongoose';

export interface IDailyMessageLog extends Document {
  customerId: Types.ObjectId;
  chatId: string;
  message: string;
  userMessages: string[]; // История сообщений пользователя на момент отправки
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dailyMessageLogSchema = new Schema<IDailyMessageLog>({
  customerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  chatId: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  userMessages: { 
    type: [String], 
    default: [] 
  },
  sentAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  collection: 'DailyMessageLogs'
});

// Индексы для быстрого поиска
dailyMessageLogSchema.index({ customerId: 1, chatId: 1 });
dailyMessageLogSchema.index({ sentAt: -1 });

const DailyMessageLog = model<IDailyMessageLog>('DailyMessageLog', dailyMessageLogSchema);

export default DailyMessageLog;
