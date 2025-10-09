import { Schema, model, Document } from 'mongoose';

export interface IPayment extends Document {
  amount: number;
  bot_name: string;
  username: string;
  type: string;
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>({
  amount: { type: Number, required: true },
  bot_name: { type: String, required: true },
  username: { type: String, required: true },
  type: { type: String, required: true },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'Payments'
});

const Payment = model<IPayment>('Payment', paymentSchema);

export default Payment;
