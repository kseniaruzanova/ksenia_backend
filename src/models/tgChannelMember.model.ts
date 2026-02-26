import { Schema, model, Document, Types } from "mongoose";

export interface ITgChannelMember extends Document {
  customerId: Types.ObjectId;
  telegramUserId: number;
  subscriptionEndsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tgChannelMemberSchema = new Schema<ITgChannelMember>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    telegramUserId: { type: Number, required: true },
    subscriptionEndsAt: { type: Date, required: true },
  },
  { timestamps: true }
);

tgChannelMemberSchema.index({ customerId: 1, telegramUserId: 1 }, { unique: true });
tgChannelMemberSchema.index({ subscriptionEndsAt: 1 });

const TgChannelMember = model<ITgChannelMember>(
  "TgChannelMember",
  tgChannelMemberSchema
);

export default TgChannelMember;
