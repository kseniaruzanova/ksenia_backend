import mongoose, { Schema, Document, Model } from 'mongoose';

export interface DailyMessagingRunResult {
  customerId: string;
  chatId: string;
  customerName: string;
  success: boolean;
  error?: string;
}

export interface DailyMessagingRunDocument extends Document {
  startedAt: Date;
  finishedAt: Date;
  total: number;
  success: number;
  failed: number;
  successRate: number;
  results: DailyMessagingRunResult[];
  trigger: 'scheduler' | 'manual' | 'test-single';
}

const ResultSchema = new Schema<DailyMessagingRunResult>({
  customerId: { type: String, required: true },
  chatId: { type: String, required: true },
  customerName: { type: String, required: true },
  success: { type: Boolean, required: true },
  error: { type: String }
}, { _id: false });

const DailyMessagingRunSchema = new Schema<DailyMessagingRunDocument>({
  startedAt: { type: Date, required: true, default: Date.now },
  finishedAt: { type: Date, required: true, default: Date.now },
  total: { type: Number, required: true },
  success: { type: Number, required: true },
  failed: { type: Number, required: true },
  successRate: { type: Number, required: true },
  results: { type: [ResultSchema], required: true, default: [] },
  trigger: { type: String, enum: ['scheduler', 'manual', 'test-single'], required: true }
});

DailyMessagingRunSchema.index({ startedAt: -1 });

const DailyMessagingRunModel: Model<DailyMessagingRunDocument> = mongoose.models.DailyMessagingRun || mongoose.model<DailyMessagingRunDocument>('DailyMessagingRun', DailyMessagingRunSchema);

export default DailyMessagingRunModel;


