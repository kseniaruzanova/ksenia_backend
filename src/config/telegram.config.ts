import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN must be provided!');
}

const bot = new Telegraf(botToken);

// Add command handler
bot.command('start', (ctx) => {
    ctx.reply(`Привет! Твой Chat ID: ${ctx.chat.id}`);
});

export default bot; 