import mongoose, { Document, Schema } from 'mongoose';

export interface IReelDocument extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  prompt: string;
  scenario?: string;
  videoUrl?: string;
  status: 'draft' | 'scenario_generated' | 'video_created';
  createdAt: Date;
  updatedAt: Date;
}

const ReelSchema = new Schema<IReelDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    scenario: {
      type: String,
      required: false,
    },
    videoUrl: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ['draft', 'scenario_generated', 'video_created'],
      default: 'draft',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'reels',
  }
);

// Индексы для оптимизации запросов
ReelSchema.index({ userId: 1, createdAt: -1 });

const Reel = mongoose.model<IReelDocument>('Reel', ReelSchema);

export default Reel;

