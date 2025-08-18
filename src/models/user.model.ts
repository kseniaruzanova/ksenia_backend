import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  chat_id: string;
  state: string;
  answer_1?: string;
  birthday?: string;
  usermessage2?: string;
  answer_2?: string;
  usermessage3?: string;
  answer_3?: string;
  answer_4?: string | null;
  usermessage4?: string;
  answer_5?: string;
  usermessage5?: string;
  answer_6?: string;
  usermessage6?: string;
  messages?: string[];
  customerId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  chat_id: { type: String, required: true },
  state: { type: String, required: true },
  answer_1: { type: String },
  birthday: { type: String },
  usermessage2: { type: String },
  answer_2: { type: String },
  usermessage3: { type: String },
  answer_3: { type: String },
  answer_4: { type: String, default: null },
  usermessage4: { type: String },
  answer_5: { type: String },
  usermessage5: { type: String },
  answer_6: { type: String },
  usermessage6: { type: String },
  messages: { type: [String] },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
}, {
  timestamps: true,
  collection: 'Users'
});

userSchema.index({ chat_id: 1, customerId: 1 }, { unique: true });

const User = model<IUser>('User', userSchema);

export default User; 