import { Schema, model, Document } from "mongoose";

/** Участники закрытого клуба (отдельно от платформенных Customer). */
export interface IClubMember extends Document {
  username: string;
  password: string;
  tariff?: "none" | "basic" | "pro" | "tg_max";
  subscriptionStatus?: "active" | "inactive" | "expired";
  subscriptionEndsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const clubMemberSchema = new Schema<IClubMember>(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    tariff: { type: String, enum: ["none", "basic", "pro", "tg_max"], default: "none" },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "inactive",
    },
    subscriptionEndsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const ClubMember = model<IClubMember>("ClubMember", clubMemberSchema);

export default ClubMember;
