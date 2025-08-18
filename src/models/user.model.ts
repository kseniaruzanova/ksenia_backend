import { Schema, model, Document, Types } from 'mongoose';

export interface IUserState {
  current?: string;
  previous?: string;
  data?: Record<string, any>;
}

export interface IUser extends Document {
  chatId: string;           // Telegram chat ID
  customerId: Types.ObjectId; // Ссылка на владельца бота
  state: IUserState;
  answers: Record<string, string | null>; // Динамические ответы
  messages: Types.ObjectId[]; // Ссылки на сообщения
  createdAt: Date;
  updatedAt: Date;
}

const UserStateSchema = new Schema<IUserState>({
  current: { type: String },
  previous: { type: String },
  data: { type: Schema.Types.Mixed }
}, { _id: false });

const UserSchema = new Schema<IUser>({
  chatId: { 
    type: String, 
    required: true 
  },
  customerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  state: { 
    type: UserStateSchema, 
    default: {} 
  },
  answers: { 
    type: Schema.Types.Mixed, 
    default: {} 
  },
  messages: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Message' 
  }]
}, {
  timestamps: true,
  collection: 'Users'
});

// Составной индекс для быстрого поиска пользователей
UserSchema.index({ chatId: 1, customerId: 1 }, { unique: true });

export const User = model<IUser>('User', UserSchema);
