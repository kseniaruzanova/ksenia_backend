import mongoose, { Document, Schema } from 'mongoose';

// Интерфейс для блока видео
export interface IVideoBlock {
  id: string;
  text: string;              // Текст для озвучки
  displayText: string;       // Текст для отображения в видео
  duration: number;          // Продолжительность в секундах
  images: string[];          // URL загруженных изображений
  audioUrl?: string;         // URL сгенерированной озвучки
  order: number;             // Порядок блока
}

// Настройки аудио
export interface IAudioSettings {
  voiceVolume: number;       // Громкость голоса (0-100)
  musicVolume: number;       // Громкость музыки (0-100)
  voiceSpeed: number;        // Скорость речи (0.5-2.0)
}

export interface IReelDocument extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  prompt: string;
  scenario?: string;
  blocks?: IVideoBlock[];           // Блоки для видео
  backgroundMusic?: string;         // URL фоновой музыки
  audioSettings?: IAudioSettings;   // Настройки аудио
  videoUrl?: string;
  status: 'draft' | 'scenario_generated' | 'blocks_created' | 'video_generating' | 'video_created';
  createdAt: Date;
  updatedAt: Date;
}

const VideoBlockSchema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  displayText: { type: String, required: true },
  duration: { type: Number, required: true, default: 10 },
  images: { type: [String], default: [] },
  audioUrl: { type: String, required: false },
  order: { type: Number, required: true }
}, { _id: false });

const AudioSettingsSchema = new Schema({
  voiceVolume: { type: Number, default: 80, min: 0, max: 100 },
  musicVolume: { type: Number, default: 30, min: 0, max: 100 },
  voiceSpeed: { type: Number, default: 1.0, min: 0.5, max: 2.0 }
}, { _id: false });

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
    blocks: {
      type: [VideoBlockSchema],
      required: false,
      default: []
    },
    backgroundMusic: {
      type: String,
      required: false,
    },
    audioSettings: {
      type: AudioSettingsSchema,
      required: false,
      default: () => ({
        voiceVolume: 80,
        musicVolume: 30,
        voiceSpeed: 1.0
      })
    },
    videoUrl: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ['draft', 'scenario_generated', 'blocks_created', 'video_generating', 'video_created'],
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

