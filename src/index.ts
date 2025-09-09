import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db';
import { botManager } from './services/botManager.service';

import authRoutes from './routes/auth.routes';
import paymentsRoutes from './routes/payments.routes';
import userRoutes from './routes/users.routes';
import messageRoutes from './routes/messages.routes';
import messageChat from './routes/messageChat.routes';
import customerRoutes from './routes/customers.routes';
import incomingMessagesRoutes from './routes/incomingMessages.routes';
import forecastRoutes from './routes/forecast.routes';
import prodamusRoutes from './routes/prodamus.routes';
import financialCast from './routes/financialCast.routes';
import mistakesIncarnation from './routes/mistakesIncarnation.routes';
import arcanumRealization from './routes/arcanumRealization.routes';
import awakeningCodes from './routes/awakeningCodes.routes';
import contentRoutes from './routes/content.routes';
import statisticsRoutes from './routes/statistics.routes';
import tarotRoutes from './routes/tarot.routes'
import astroRoutes from './routes/astro.routes'
import videoRoutes from './routes/videos.route';
import qs from 'qs'
import path from "path";

dotenv.config();

const app = express();

// Инициализация базы данных и BotManager
const initializeApp = async () => {
    try {
        // Подключаемся к базе данных
        await connectDB();
        console.log('✅ Database connected');

        // Инициализируем BotManager после подключения к БД
        await botManager.initialize();
        console.log('✅ BotManager initialized');

        // Слушаем события от BotManager
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

        // Новые события для обработки входящих сообщений
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

        // События webhook
        botManager.on('webhook:success', (data) => {
            console.log(`🌐 Webhook delivered for customer ${data.customerId} (${data.status})`);
        });

        botManager.on('webhook:error', (data) => {
            console.error(`❌ Webhook failed for customer ${data.customerId}:`, data.error);
        });

        // Запускаем периодическую синхронизацию каждые 5 минут как fallback
        setInterval(async () => {
            try {
                await botManager.syncWithDatabase();
            } catch (error) {
                console.error('❌ Periodic sync failed:', error);
            }
        }, 5 * 60 * 1000); // 5 минут

        console.log('⏰ Periodic sync scheduled every 5 minutes');

    } catch (error) {
        console.error('❌ Failed to initialize app:', error);
        process.exit(1);
    }
};

initializeApp();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.set('query parser', (str: string) => qs.parse(str))

app.get('/', (req, res) => {
    res.send('API is running...');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/chat/messages', messageChat);
app.use('/api/customers', customerRoutes);
app.use('/api/incoming', incomingMessagesRoutes);

app.use('/api/forecast', forecastRoutes);
app.use('/api/financialCast', financialCast);
app.use('/api/mistakesIncarnation', mistakesIncarnation);
app.use('/api/arcanumRealization', arcanumRealization);
app.use('/api/awakeningCodes', awakeningCodes);
app.use('/api/tarot', tarotRoutes);

app.use('/api/content', contentRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/statistics', statisticsRoutes);

app.use('/api/prodamus', prodamusRoutes);
app.use('/api/astro', astroRoutes);

app.use('/api/videos', videoRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
