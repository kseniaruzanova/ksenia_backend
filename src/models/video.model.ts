import mongoose, { Document, Schema } from "mongoose";

export interface IVideo extends Document {
  title: string;
  description: string;
  type: "file" | "link";
  source: string; // filename for 'file', URL for 'link'
  thumbnail?: string | mongoose.Types.ObjectId; // filename or URL
  playlistId?: mongoose.Types.ObjectId;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["file", "link"], required: true },
    source: { type: Schema.Types.Mixed, required: true },
    thumbnail: { type: Schema.Types.Mixed, default: null }, // can be string (path/URL) or ObjectId
    playlistId: { type: Schema.Types.ObjectId, ref: "Playlist", default: null },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model<IVideo>("Video", VideoSchema);
