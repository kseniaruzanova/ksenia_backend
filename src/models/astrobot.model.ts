import mongoose, { Schema, Document, Model } from "mongoose";

interface IChat extends Document {
  chatId: number;
  type: string;
  title?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

const ChatSchema = new Schema<IChat>({
  chatId: { type: Number, unique: true, index: true },
  type: String,
  title: String,
  username: String,
  firstName: String,
  lastName: String,
});

interface IMessage extends Document {
  messageId: number;
  chatId: number;
  userId?: number;
  text?: string;
  date: Date;
}

const MessageSchema = new Schema<IMessage>({
  messageId: Number,
  chatId: Number,
  userId: Number,
  text: String,
  date: { type: Date, default: Date.now },
});

export const AstroBotChat: Model<IChat> = mongoose.model<IChat>("AstroBotChat", ChatSchema);
export const AstroBotMessage: Model<IMessage> = mongoose.model<IMessage>("AstroBotMessage", MessageSchema);
