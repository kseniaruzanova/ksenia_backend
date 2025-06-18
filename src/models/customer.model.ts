import { Schema, model, Document } from 'mongoose';

export interface ICustomer extends Document {
  username: string;
  password?: string;
  botToken: string;
  currentPrice?: number;
  basePrice?: number;
  cardNumber?: string;
  cardHolderName?: string;
  otherCountries?: string;
  sendTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  botToken: { type: String, required: true },
  currentPrice: { type: Number },
  basePrice: { type: Number },
  cardNumber: { type: String },
  cardHolderName: { type: String },
  otherCountries: { type: String },
  sendTo: { type: String },
}, {
  timestamps: true,
});

const Customer = model<ICustomer>('Customer', customerSchema);

export default Customer; 