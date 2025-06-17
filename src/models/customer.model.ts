import { Schema, model, Document } from 'mongoose';

export interface ICustomer extends Document {
  username: string;
  password?: string;
  botToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  botToken: { type: String, required: true },
}, {
  timestamps: true,
});

const Customer = model<ICustomer>('Customer', customerSchema);

export default Customer; 