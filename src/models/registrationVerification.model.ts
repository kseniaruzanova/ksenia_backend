import { Document, Schema, model } from "mongoose";

export interface IRegistrationVerification extends Document {
  username: string;
  channel: "email" | "phone";
  email?: string;
  phone?: string;
  password: string;
  desiredTariff: "none" | "basic" | "pro" | "tg_max";
  code: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const registrationVerificationSchema = new Schema<IRegistrationVerification>({
  username: { type: String, required: true, index: true },
  channel: { type: String, enum: ["email", "phone"], required: true },
  email: { type: String },
  phone: { type: String },
  password: { type: String, required: true },
  desiredTariff: { type: String, enum: ["none", "basic", "pro", "tg_max"], default: "none" },
  code: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
}, {
  timestamps: true,
});

registrationVerificationSchema.index({ username: 1, channel: 1 });

const RegistrationVerification = model<IRegistrationVerification>(
  "RegistrationVerification",
  registrationVerificationSchema
);

export default RegistrationVerification;
