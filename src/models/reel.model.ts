import mongoose, { Document, Schema } from 'mongoose';

// Интерфейс для блока видео
export interface IVideoBlock {
  id: string;
  text: string;              // Текст для озвучки
  displayText: string;       // Текст для отображения в видео
  duration: number;          // Продолжительность в секундах
  images: string[];          // URL загруженных изображений
  imagePrompts?: string[];   // Промпты для генерации изображений
  imageAnimation?: string;   // Тип анимации для изображений (zoom-in, zoom-out, pan-left, pan-right, none)
  transition?: string;       // Переход к следующему блоку (fade, dissolve, wipe, none)
  scrollingText?: boolean;   // Бегущий текст
  audioUrl?: string;         // URL сгенерированной озвучки
  order: number;             // Порядок блока
  imageGenerationStatus?: 'pending' | 'generating' | 'completed' | 'failed'; // Статус генерации изображений
  imageGenerationProgress?: number; // Прогресс генерации изображений (0-100)
  imageGenerationError?: string; // Ошибка генерации изображений
}

// Настройки аудио
export interface IAudioSettings {
  voiceVolume: number;       // Громкость голоса (0-100)
  musicVolume: number;       // Громкость музыки (0-100)
  voiceSpeed: number;        // Скорость речи (0.5-2.0)
}

// Интерфейс для отслеживания прогресса генерации видео
export interface IVideoGenerationProgress {
  currentStep: string;              // Текущий шаг генерации
  stepProgress: number;            // Прогресс текущего шага (0-100)
  totalProgress: number;            // Общий прогресс (0-100)
  estimatedTimeRemaining?: number;  // Оставшееся время в секундах
  logs: string[];                   // Логи процесса генерации
  error?: string;                   // Ошибка, если есть
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
  status: 'draft' | 'scenario_generated' | 'blocks_created' | 'generating_images' | 'video_generating' | 'video_created' | 'error';
  generationProgress?: IVideoGenerationProgress; // Прогресс генерации видео
  createdAt: Date;
  updatedAt: Date;
}

const VideoBlockSchema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  displayText: { type: String, required: true },
  duration: { type: Number, required: true, default: 10 },
  images: { type: [String], default: [] },
  imagePrompts: { type: [String], default: [] },
  imageAnimation: { 
    type: String, 
    enum: ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'none'],
    default: 'zoom-in'
  },
  transition: { 
    type: String, 
    enum: ['fade', 'dissolve', 'wipe', 'none'],
    default: 'fade'
  },
  scrollingText: { type: Boolean, default: false },
  audioUrl: { type: String, required: false },
  order: { type: Number, required: true },
  imageGenerationStatus: { 
    type: String, 
    enum: ['pending', 'generating', 'completed', 'failed'],
    default: 'pending'
  },
  imageGenerationProgress: { type: Number, default: 0, min: 0, max: 100 },
  imageGenerationError: { type: String, required: false }
}, { _id: false });

const AudioSettingsSchema = new Schema({
  voiceVolume: { type: Number, default: 80, min: 0, max: 100 },
  musicVolume: { type: Number, default: 30, min: 0, max: 100 },
  voiceSpeed: { type: Number, default: 1.0, min: 0.5, max: 2.0 }
}, { _id: false });

const VideoGenerationProgressSchema = new Schema({
  currentStep: { type: String, default: 'Инициализация' },
  stepProgress: { type: Number, default: 0, min: 0, max: 100 },
  totalProgress: { type: Number, default: 0, min: 0, max: 100 },
  estimatedTimeRemaining: { type: Number, required: false },
  logs: { type: [String], default: [] },
  error: { type: String, required: false }
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
      enum: ['draft', 'scenario_generated', 'blocks_created', 'generating_images', 'video_generating', 'video_created', 'error'],
      default: 'draft',
      required: true,
    },
    generationProgress: {
      type: VideoGenerationProgressSchema,
      required: false,
      default: () => ({
        currentStep: 'Инициализация',
        stepProgress: 0,
        totalProgress: 0,
        logs: []
      })
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

