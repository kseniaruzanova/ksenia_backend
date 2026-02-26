import { Schema, model, Document, Types } from "mongoose";

export interface ITgChannelInviteToken extends Document {
  token: string;
  customerId: Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const tgChannelInviteTokenSchema = new Schema<ITgChannelInviteToken>(
  {
    token: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Индекс для быстрого поиска по токену и проверки срока
tgChannelInviteTokenSchema.index({ token: 1 });
tgChannelInviteTokenSchema.index({ expiresAt: 1 });

const TgChannelInviteToken = model<ITgChannelInviteToken>(
  "TgChannelInviteToken",
  tgChannelInviteTokenSchema
);

export default TgChannelInviteToken;
