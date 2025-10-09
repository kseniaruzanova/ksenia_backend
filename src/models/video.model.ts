import mongoose, { Document, Schema } from "mongoose";

export interface IVideo extends Document {
  title: string;
  description: string;
  type: "file" | "link";
  source: mongoose.Types.ObjectId | string;
  thumbnail?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["file", "link"], required: true },
    source: { type: Schema.Types.Mixed, required: true },
    thumbnail: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IVideo>("Video", VideoSchema);
