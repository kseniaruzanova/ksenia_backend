import mongoose, { Schema, Document, Model } from 'mongoose';

export interface DailyMessagingConfigDocument extends Document {
  key: string;
  enabled: boolean;
  time: string;
  timezone: string;
  maxConcurrency: number;
  perMessageDelayMs: number;
  promptSystem: string;
  promptUserTemplate: string;
  llmModel: string;
  temperature: number;
  sendFormat: 'Markdown' | 'HTML';
  updatedAt: Date;
}

const DailyMessagingConfigSchema = new Schema<DailyMessagingConfigDocument>({
  key: { type: String, required: true, unique: true, index: true, default: 'default' },
  enabled: { type: Boolean, required: true, default: false },
  time: { type: String, required: true, default: '09:00' },
  timezone: { type: String, required: true, default: 'Europe/Moscow' },
  maxConcurrency: { type: Number, required: true, default: 3 },
  perMessageDelayMs: { type: Number, required: true, default: 0 },
  promptSystem: { type: String, required: true, default: '' },
  promptUserTemplate: { type: String, required: true, default: '' },
  llmModel: { type: String, required: true, default: 'openai/gpt-4o-mini' },
  temperature: { type: Number, required: true, default: 0.7 },
  sendFormat: { type: String, enum: ['Markdown', 'HTML'], required: true, default: 'Markdown' },
  updatedAt: { type: Date, default: Date.now }
});

DailyMessagingConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const DailyMessagingConfigModel: Model<DailyMessagingConfigDocument> = mongoose.models.DailyMessagingConfig || mongoose.model<DailyMessagingConfigDocument>('DailyMessagingConfig', DailyMessagingConfigSchema);

export default DailyMessagingConfigModel;


