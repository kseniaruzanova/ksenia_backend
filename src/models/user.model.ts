import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  chat_id: string;
  state: string;
  birthday?: string;
  question?: string;
  birthTime?: string;
  latitude?: number;
  longitude?: number;
  timezone?: number;
  city_name?: string;
  messages?: string[];
  customerId: Schema.Types.ObjectId;
  adminChatMode?: boolean; // Режим прямого общения с админом
  subscriptionStatus?: 'active' | 'inactive' | 'expired';
  subscriptionExpiresAt?: Date | null;
  lastSubscriptionPaymentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  chat_id: { type: String, required: true },
  state: { type: String, required: true },
  birthday: { type: String },
  question: { type: String },
  birthTime: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  timezone: { type: Number },
  city_name: { type: String },
  messages: { type: [String] },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  adminChatMode: { type: Boolean, default: false }, // Режим прямого общения с админом
  subscriptionStatus: { type: String, enum: ['active', 'inactive', 'expired'], default: 'inactive' },
  subscriptionExpiresAt: { type: Date, default: null },
  lastSubscriptionPaymentAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'Users'
});

userSchema.index({ chat_id: 1, customerId: 1 }, { unique: true });

const User = model<IUser>('User', userSchema);

export default User; 
