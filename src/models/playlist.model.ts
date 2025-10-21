import mongoose, { Document, Schema } from "mongoose";

export interface IPlaylist extends Document {
  name: string;
  description?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlaylistSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model<IPlaylist>("Playlist", PlaylistSchema);

