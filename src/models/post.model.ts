import mongoose, { Document, Schema } from "mongoose";

export type PostAttachmentKind = "image" | "video" | "file";

export interface IPostAttachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: PostAttachmentKind;
}

export interface IPost extends Document {
  title?: string;
  content: string;
  attachments: IPostAttachment[];
  isPinned: boolean;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PostAttachmentSchema = new Schema<IPostAttachment>(
  {
    filename: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, default: 0 },
    kind: { type: String, enum: ["image", "video", "file"], required: true }
  },
  { _id: false }
);

const PostSchema: Schema = new Schema(
  {
    title: { type: String, default: "", trim: true },
    content: { type: String, default: "" },
    attachments: { type: [PostAttachmentSchema], default: [] },
    isPinned: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model<IPost>("Post", PostSchema);
