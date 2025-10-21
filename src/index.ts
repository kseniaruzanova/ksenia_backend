import qs from "qs"
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";

import connectDB from "./config/db";

import dailyMessagingService from "./services/dailyMessaging.service";

import authRoutes from "./routes/auth.routes";
import astroRoutes from './routes/astro.routes'
import videoRoutes from './routes/videos.route';
import playlistsRoutes from './routes/playlists.routes';
import contentRoutes from "./routes/content.routes";
import customerRoutes from "./routes/customers.routes";
import dailyMessagingRoutes from './routes/dailyMessaging.routes';
import chatRoutes from './routes/chat.routes';
import messagesRoutes from './routes/messages.routes';
import usersRoutes from './routes/users.routes';
import aiSettingsRoutes from './routes/aiSettings.routes';
import reelsRoutes from './routes/reels.routes';
import uploadRoutes from './routes/upload.routes';

import forecastRoutes from "./routes/products/forecast.routes";
import financialCastRoutes from "./routes/products/financialCast.routes";
import awakeningCodesRoutes from "./routes/products/awakeningCodes.routes";
import arcanumRealizationRoutes from "./routes/products/arcanumRealization.routes";
import mistakesIncarnationRoutes from "./routes/products/mistakesIncarnation.routes";
import matrixLifeRoutes from "./routes/products/matrixLife.routes";
import karmicTailRoutes from "./routes/products/karmicTail.routes";

import tarotRoutes from "./routes/tarot.routes";
import prodamusRoutes from "./routes/prodamus.routes";
import paymentsRoutes from "./routes/payments.routes";
import geocodingRoutes from "./routes/geocoding.routes";
import statisticsRoutes from "./routes/statistics.routes";
import productStatisticsRoutes from "./routes/productStatistics.routes";
import botManager from "./services/botManager.service";
import { setBotManagerInstance } from "./lib/botManagerInstance";

dotenv.config();

const app = express();

// Функция создания необходимых директорий
const ensureDirectoriesExist = () => {
  const directories = [
    'uploads',
    'uploads/images',
    'uploads/audio',
    'uploads/videos',
    'temp'
  ];

  console.log('📁 Checking required directories...');

  directories.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    } else {
      console.log(`✓ Directory exists: ${dir}`);
    }
  });

  console.log('✅ All required directories ready');
};

const initializeApp = async () => {
  try {
    // Создаем необходимые папки
    ensureDirectoriesExist();

    await connectDB();
    console.log('✅ Database connected');

    await botManager.initialize();
    console.log('✅ BotManager initialized');

    // Устанавливаем глобальный экземпляр BotManager для использования в webhook
    setBotManagerInstance(botManager);
    console.log('✅ BotManager instance set globally');

    botManager.on('bot:added', (data) => {
        console.log(`🤖 Bot added: ${data.username} (@${data.botUsername})`);
    });

    botManager.on('bot:updated', (data) => {
        console.log(`🔄 Bot updated: ${data.username} (@${data.botUsername})`);
    });

    botManager.on('bot:removed', (data) => {
        console.log(`🗑️ Bot removed: ${data.username}`);
    });

    botManager.on('bot:error', (data) => {
        console.log(`❌ Bot error for ${data.username}:`, data.error);
    });

    botManager.on('change:error', (data) => {
        console.error('❌ Customer change handling error:', data.error);
    });

    botManager.on('bot:listening:started', (data) => {
        console.log(`👂 Bot listening started: ${data.username}`);
    });

    botManager.on('bot:listening:stopped', (data) => {
        console.log(`🔇 Bot listening stopped: ${data.username}`);
    });

    botManager.on('message:received', (data) => {
        console.log(`📨 Message received from customer ${data.customerId}: ${data.type}`);
    });

    botManager.on('bot:message:error', (data) => {
        console.error(`❌ Bot message error for ${data.username}:`, data.error);
    });

    dailyMessagingService.on('birthday:sent', (data) => {
      console.log(`🎂 Birthday message sent to ${data.chatId} (${data.customerName}): "${data.message}"`);
    });

    dailyMessagingService.on('birthday:failed', (data) => {
      console.error(`❌ Birthday message failed for ${data.chatId} (${data.customerName}):`, data.error);
    });

    dailyMessagingService.on('birthday:completed', (data) => {
      console.log(`🎂 Birthday messaging completed: ${data.success}/${data.total} successful`);
    });

    dailyMessagingService.on('scheduler:started', () => {
      console.log('🚀 Birthday messaging scheduler started');
    });

    dailyMessagingService.on('scheduler:stopped', () => {
      console.log('🛑 Birthday messaging scheduler stopped');
    });

    await botManager.syncWithDatabase();
    
    setInterval(async () => {
      try {
        await botManager.syncWithDatabase();
      } catch (error) {
        console.error('❌ Periodic sync failed:', error);
      }
    }, 5 * 60 * 1000);

    console.log('⏰ Periodic sync scheduled every 5 minutes');

    try {
      await dailyMessagingService.initializeFromDatabase();
      const cfg = dailyMessagingService.getConfig();
      if (cfg.enabled) {
        dailyMessagingService.startDailyScheduler();
        console.log('📅 Daily messaging scheduler started from persisted config');
      } else {
        console.log('⏸️ Daily messaging is disabled by persisted config');
      }
    } catch (error) {
      console.error('❌ Failed to initialize daily messaging from DB:', error);
    }

  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    process.exit(1);
  }
};

initializeApp();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статическая раздача загруженных файлов
app.use('/api/uploads', express.static('uploads'));
app.set('query parser', (str: string) => qs.parse(str))

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ai-settings', aiSettingsRoutes);

app.use('/api/forecast', forecastRoutes);
app.use('/api/financialCast', financialCastRoutes);
app.use('/api/awakeningCodes', awakeningCodesRoutes);
app.use('/api/mistakesIncarnation', mistakesIncarnationRoutes);
app.use('/api/arcanumRealization', arcanumRealizationRoutes);
app.use('/api/matrixLife', matrixLifeRoutes);
app.use('/api/karmicTail', karmicTailRoutes);

app.use('/api/tarot', tarotRoutes);
app.use('/api/astro', astroRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/prodamus', prodamusRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/product-statistics', productStatisticsRoutes);
app.use('/api/daily-messaging', dailyMessagingRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/reels', reelsRoutes);
app.use('/api/upload', uploadRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
