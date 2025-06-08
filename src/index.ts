import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db';
import bot from './config/telegram.config';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import messageRoutes from './routes/messages.routes';

dotenv.config();

const app = express();
connectDB();

// Initialize bot
bot.launch().then(() => {
    console.log('Telegram bot started successfully');
}).catch((error) => {
    console.error('Error starting Telegram bot:', error);
    process.exit(1);
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});