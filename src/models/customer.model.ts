import { Schema, model, Document } from "mongoose";

export interface ICustomer extends Document {
  username: string;
  password?: string;
  botToken: string;
  tariff?: 'none' | 'basic' | 'pro' | 'tg_max';
  subscriptionStatus?: 'active' | 'inactive' | 'expired';
  subscriptionEndsAt?: Date;
  currentPrice?: number;
  basePrice?: number;
  cardNumber?: string;
  cardHolderName?: string;
  otherCountries?: string;
  sendTo?: string;
  paymentInstructions?: string;
  willGuideToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  botToken: { type: String, required: true },

  tariff: { type: String, enum: ['none', 'basic', 'pro', 'tg_max'], default: "none" },
  subscriptionStatus: { type: String, enum: ['active', 'inactive', 'expired'], default: 'inactive' },
  subscriptionEndsAt: { type: Date, default: null },

  currentPrice: { type: Number },
  basePrice: { type: Number },
  cardNumber: { type: String },
  cardHolderName: { type: String },
  otherCountries: { type: String },
  sendTo: { type: String },
  paymentInstructions: { type: String },
  willGuideToken: { type: String },
}, {
  timestamps: true,
});

const Customer = model<ICustomer>('Customer', customerSchema);

export default Customer; 
