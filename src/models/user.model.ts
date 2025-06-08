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
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  chat_id: { type: String, required: true, unique: true },
  state: { type: String, required: true },
  answer_1: { type: String },
  birthday: { type: String },
  usermessage2: { type: String },
  answer_2: { type: String },
  usermessage3: { type: String },
  answer_3: { type: String },
  answer_4: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'Users'
});

const User = model<IUser>('User', userSchema);

export default User; 