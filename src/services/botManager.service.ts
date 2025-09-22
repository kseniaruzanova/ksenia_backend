import { Telegraf } from 'telegraf';
import Customer from '../models/customer.model';
import User from '../models/user.model';

import { Chat, IChat } from '../models/chat.model';
import { Message, IMessage, MessageType } from '../models/messages.model';

import { EventEmitter } from 'events';

// Конфигурация webhook
const isDevelopment = process.env.mode === 'development';
const WEBHOOK_URL = isDevelopment
  ? (process.env.WEBHOOK_URL_TEST || 'https://kseniaksenia.app.n8n.cloud/webhook-test/553f7b06-cbaa-40f8-9430-226fd44cbb30')
  : (process.env.WEBHOOK_URL_PROD || 'https://kseniaksenia.app.n8n.cloud/webhook/553f7b06-cbaa-40f8-9430-226fd44cbb30');

console.log(`🌐 Webhook configured for ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode: ${WEBHOOK_URL}`);

// Вспомогательные функции для обработки типов сообщений
function getMessageType(message: any): string {
    if (message.text) return 'text';
    if (message.photo) return 'photo';
    if (message.document) return 'document';
    if (message.video) return 'video';
    if (message.audio) return 'audio';
    if (message.voice) return 'voice';
    if (message.video_note) return 'video_note';
    if (message.sticker) return 'sticker';
    if (message.animation) return 'animation';
    if (message.location) return 'location';
    if (message.contact) return 'contact';
    if (message.poll) return 'poll';
    if (message.dice) return 'dice';
    return 'unknown';
}

function getMessageTypeEmoji(type: string): string {
    const emojis: { [key: string]: string } = {
        video: '🎥',
        audio: '🎵',
        voice: '🎤',
        video_note: '📹',
        sticker: '🎭',
        animation: '🎬',
        location: '📍',
        contact: '👤',
        poll: '📊',
        dice: '🎲',
        unknown: '📨'
    };
    return emojis[type] || '📨';
}

function getMessageTypeText(type: string): string {
    const texts: { [key: string]: string } = {
        video: 'Видео',
        audio: 'Аудио',
        voice: 'Голосовое сообщение',
        video_note: 'Видеосообщение',
        sticker: 'Стикер',
        animation: 'GIF',
        location: 'Геолокация',
        contact: 'Контакт',
        poll: 'Опрос',
        dice: 'Кубик',
        unknown: 'Сообщение'
    };
    return texts[type] || 'Сообщение';
}

interface BotInstance {
    bot: Telegraf;
    customerId: string;
    username: string;
    token: string;
    status: 'active' | 'inactive' | 'error';
    lastUpdated: Date;
    isListening: boolean;
}

class BotManager extends EventEmitter {
    private bots: Map<string, BotInstance> = new Map();
    private changeStream: any = null;
    private isWatching: boolean = false;

    constructor() {
        super();
        console.log('🤖 BotManager initialized');
        this.startSubscriptionChecker();
    }

    private async handleIncomingMessage(customerId: string, ctx: any) {
        const chatId = ctx.chat.id.toString();
        const userId = ctx.from.id.toString();
        const messageType = getMessageType(ctx.message);

        try {
            // 1. Сохраняем/обновляем информацию о чате
            const chat = await this.saveChat(customerId, chatId, userId, ctx.from);

            // 2. Сохраняем сообщение
            await this.saveMessage({
                chat,
                customerId,
                messageId: ctx.message.message_id.toString(),
                type: messageType as MessageType,
                direction: 'in',
                content: this.extractMessageContent(ctx.message, messageType),
                ctx
            });

            console.log(`💾 Saved ${messageType} message from ${chatId} for customer ${customerId}`);
        } catch (error) {
            console.error(`❌ Error saving message from ${chatId}:`, error);
            this.emit('message:save:error', { customerId, chatId, error });
        }
    }

    private async saveChat(
        customerId: string,
        chatId: string,
        userId: string,
        from: any
    ): Promise<IChat> {
        const chatData = {
            customerId: customerId,
            chatId,
            userId,
            meta: {
                firstName: from.first_name,
                lastName: from.last_name,
                username: from.username,
                lastMessageAt: new Date()
            }
        };

        return Chat.findOneAndUpdate(
            { customerId: chatData.customerId, chatId },
            { 
                $set: chatData,
                $setOnInsert: { 
                    status: 'active',
                    createdAt: new Date() 
                }
            },
            { upsert: true, new: true }
        );
    }

    private async saveMessage(data: {
        chat: IChat;
        customerId: string;
        messageId: string;
        type: MessageType;
        direction: 'in' | 'out';
        content: any;
        ctx?: any;
    }): Promise<IMessage> {
        const message = await Message.create({
            chatId: data.chat._id,
            customerId: data.customerId,
            messageId: data.messageId,
            type: data.type,
            direction: data.direction,
            content: data.content,
            timestamp: new Date()
        });

        // Обновляем метаданные чата
        await Chat.updateOne(
            { _id: data.chat._id },
            { 
                $set: { 'meta.lastMessageAt': new Date() },
                $inc: { 
                    'meta.unreadCount': data.direction === 'in' ? 1 : 0 
                }
            }
        );

        return message;
    }

    private extractMessageContent(message: any, type: string): any {
        const baseContent = {
            text: message.text,
            caption: message.caption
        };

        switch(type) {
            case 'photo':
                return {
                    ...baseContent,
                    fileIds: message.photo.map((p: any) => p.file_id)
                };
            case 'document':
                return {
                    ...baseContent,
                    fileId: message.document.file_id,
                    fileName: message.document.file_name
                };
            case 'video':
                return {
                    ...baseContent,
                    fileId: message.video.file_id
                };
            default:
                return baseContent;
        }
    }

    // Новый метод для периодической проверки истекших подписок
    private startSubscriptionChecker() {
        setInterval(async () => {
            console.log('⏰ Checking for expired subscriptions...');
            const customers = await Customer.find({ 
                subscriptionStatus: 'active',
                subscriptionEndsAt: { $lt: new Date() } 
            });

            for (const customer of customers) {
                console.log(`⌛ Subscription expired for ${customer.username}. Deactivating...`);
                customer.subscriptionStatus = 'expired';
                await customer.save(); // Это вызовет наш middleware и остановит бота
            }
        }, 3600 * 1000); // Проверять каждый час
    }

    // Функция для очистки объекта от циклических ссылок
    private cleanObjectForJSON(obj: any, maxDepth: number = 10, currentDepth: number = 0): any {
        if (currentDepth >= maxDepth) {
            return '[Max Depth Reached]';
        }

        if (obj === null || obj === undefined) {
            return obj;
        }

        if (typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return obj.toISOString();
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.cleanObjectForJSON(item, maxDepth, currentDepth + 1));
        }

        // Пропускаем внутренние объекты Node.js/Telegraf, которые могут содержать циклы
        if (obj.constructor && (
          obj.constructor.name === 'TLSSocket' ||
          obj.constructor.name === 'HTTPParser' ||
          obj.constructor.name === 'ClientRequest' ||
          obj.constructor.name === 'IncomingMessage' ||
          obj.constructor.name === 'Socket' ||
          obj.constructor.name === 'Server'
        )) {
            return '[Internal Node.js Object]';
        }

        const cleaned: any = {};
        const seen = new WeakSet();

        for (const key in obj) {
            try {
                const value = obj[key];

                if (value && typeof value === 'object') {
                    if (seen.has(value)) {
                        cleaned[key] = '[Circular Reference]';
                        continue;
                    }
                    seen.add(value);
                }

                cleaned[key] = this.cleanObjectForJSON(value, maxDepth, currentDepth + 1);
            } catch (error) {
                cleaned[key] = '[Error accessing property]';
            }
        }

        return cleaned;
    }

    // Отправка данных на внешний webhook
    private async sendToWebhook(customerId: string, updateData: any) {
        try {
            // Получаем информацию о боте и очищаем от циклических ссылок
            const botInfo = this.getBotInfo(customerId);
            const cleanBotInfo = botInfo ? {
                customerId: botInfo.customerId,
                username: botInfo.username,
                status: botInfo.status,
                isListening: botInfo.isListening,
                lastUpdated: botInfo.lastUpdated
            } : null;

            // Очищаем updateData от циклических ссылок
            const cleanUpdateData = this.cleanObjectForJSON(updateData);

            const webhookPayload = {
                customerId,
                update: cleanUpdateData,
                timestamp: new Date().toISOString(),
                botInfo: cleanBotInfo
            };

            console.log(`🌐 Sending update to webhook for customer ${customerId}...`);

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookPayload)
            });

            if (response.ok) {
                console.log(`✅ Webhook delivered successfully for customer ${customerId}`);
                this.emit('webhook:success', { customerId, status: response.status });
            } else {
                console.error(`❌ Webhook failed for customer ${customerId}: ${response.status} ${response.statusText}`);
                this.emit('webhook:error', { customerId, status: response.status, error: response.statusText });
            }
        } catch (error) {
            console.error(`❌ Error sending to webhook for customer ${customerId}:`, error);
            this.emit('webhook:error', { customerId, error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }

    // Инициализация - загружаем всех ботов
    async initialize() {
        console.log('🔄 Initializing BotManager...');

        try {
            // Загружаем всех существующих кастомеров
            await this.loadAllBots();

            console.log(`✅ BotManager initialized with ${this.bots.size} bots`);
            console.log('📡 Using Mongoose middleware for change detection (no replica set required)');
            this.emit('manager:initialized', { botsCount: this.bots.size });
        } catch (error) {
            console.error('❌ Error initializing BotManager:', error);
            this.emit('manager:error', { error });
        }
    }

    // Загружаем всех ботов из базы
    private async loadAllBots() {
        console.log('🔍 Loading all customers from database...');

        const customers = await Customer.find({}, 'username botToken _id subscriptionStatus subscriptionEndsAt');
        console.log(`📊 Found ${customers.length} customers in database`);

        if (customers.length === 0) {
            console.log('⚠️ No customers found in database');
            return;
        }

        // Обрабатываем всех кастомеров параллельно
        const botPromises = customers.map(async (customer) => {
            console.log(`👤 Processing customer: ${customer.username}, has token: ${!!customer.botToken}`);

            const isSubscriptionActive = customer.subscriptionStatus === 'active' && customer.subscriptionEndsAt && customer.subscriptionEndsAt > new Date();

            if (customer.botToken && isSubscriptionActive) {
                try {
                    console.log(`✅ Subscription active for ${customer.username}. Adding bot.`);
                    await this.addBot((customer._id as any).toString(), customer.username, customer.botToken);
                } catch (error) {
                    console.error(`❌ Failed to process customer ${customer.username}:`, error);
                }
            } else {
                console.log(`🚫 Customer ${customer.username} has no bot token or an inactive subscription.`);
            }
        });

        // Ждем завершения обработки всех кастомеров
        await Promise.allSettled(botPromises);

        console.log(`🎯 Loaded ${this.bots.size} bots out of ${customers.length} customers`);
    }

    // Настройка обработчиков входящих сообщений для бота
    private setupBotHandlers(bot: Telegraf, customerId: string, username: string) {
        // Обработчик команды /start
        bot.start(async (ctx) => {
            await this.handleIncomingMessage(customerId, ctx);

            const chatId = ctx.chat.id.toString();
            const firstName = ctx.from?.first_name || '';
            const lastName = ctx.from?.last_name || '';
            const telegramUsername = ctx.from?.username || '';

            console.log(`👋 /start command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

            try {
                // Отправляем Update на webhook
                await this.sendToWebhook(customerId, {
                    update_id: ctx.update.update_id,
                    message: ctx.update.message,
                    type: 'start_command',
                    chat_id: chatId,
                    from: ctx.from,
                    text: '/start'
                });

                // Создаем или обновляем пользователя
                await User.findOneAndUpdate(
                  { chat_id: chatId, customerId: customerId },
                  {
                      $set: {
                          chat_id: chatId,
                          customerId: customerId
                      },
                      $setOnInsert: {
                          state: 'new_chat',
                          createdAt: new Date()
                      }
                  },
                  { upsert: true, new: true }
                );

                // Приветствие отправляется через n8n
                this.emit('message:received', {
                    customerId,
                    chatId,
                    type: 'command',
                    command: 'start',
                    from: { firstName, lastName, username: telegramUsername }
                });
            } catch (error) {
                console.error(`❌ Error handling /start for customer ${username}:`, error);
                // Ошибки обрабатываются через n8n
            }
        });

        // Обработчик всех текстовых сообщений
        bot.on('text', async (ctx) => {
            await this.handleIncomingMessage(customerId, ctx);

            const chatId = ctx.chat.id.toString();
            const text = ctx.message.text;
            const firstName = ctx.from?.first_name || '';
            const lastName = ctx.from?.last_name || '';
            const telegramUsername = ctx.from?.username || '';

            console.log(`💬 Text message from ${firstName} (@${telegramUsername}) in chat ${chatId}: "${text}" for customer ${username}`);

            try {
                // Отправляем Update на webhook
                await this.sendToWebhook(customerId, {
                    update_id: ctx.update.update_id,
                    message: {
                        message_id: ctx.message.message_id,
                        from: ctx.from,
                        chat: ctx.chat,
                        date: ctx.message.date,
                        text: ctx.message.text
                    },
                    type: 'text_message',
                    chat_id: chatId,
                    from: ctx.from,
                    text: text
                });

                // Находим пользователя
                let user = await User.findOne({ chat_id: chatId, customerId: customerId });

                if (!user) {
                    // Если пользователя нет, создаем его
                    user = await User.create({
                        chat_id: chatId,
                        customerId: customerId,
                        state: 'new_chat'
                    });
                }

                // Обрабатываем сообщение в зависимости от состояния пользователя
                await this.handleUserMessage(ctx, user, text, customerId, username);

                this.emit('message:received', {
                    customerId,
                    chatId,
                    type: 'text',
                    text,
                    from: { firstName, lastName, username: telegramUsername }
                });
            } catch (error) {
                console.error(`❌ Error handling text message for customer ${username}:`, error);
                // Ошибки обрабатываются через n8n
            }
        });

        // Обработчик фото
        bot.on('photo', async (ctx) => {
            await this.handleIncomingMessage(customerId, ctx);

            const chatId = ctx.chat.id.toString();
            const caption = ctx.message.caption || '';

            console.log(`📸 Photo received in chat ${chatId} with caption: "${caption}" for customer ${username}`);

            try {
                // Отправляем Update на webhook
                await this.sendToWebhook(customerId, {
                    update_id: ctx.update.update_id,
                    message: {
                        message_id: ctx.message.message_id,
                        from: ctx.from,
                        chat: ctx.chat,
                        date: ctx.message.date,
                        photo: ctx.message.photo,
                        caption: ctx.message.caption
                    },
                    type: 'photo_message',
                    chat_id: chatId,
                    from: ctx.from,
                    photo: ctx.message.photo,
                    caption: caption
                });

                // Ответ обрабатывается через n8n

                this.emit('message:received', {
                    customerId,
                    chatId,
                    type: 'photo',
                    caption
                });
            } catch (error) {
                console.error(`❌ Error handling photo for customer ${username}:`, error);
                // Ошибки обрабатываются через n8n
            }
        });

        // Обработчик документов
        bot.on('document', async (ctx) => {
            await this.handleIncomingMessage(customerId, ctx);

            const chatId = ctx.chat.id.toString();
            const fileName = ctx.message.document.file_name || 'unknown';

            console.log(`📄 Document received in chat ${chatId}: ${fileName} for customer ${username}`);

            try {
                // Отправляем Update на webhook
                await this.sendToWebhook(customerId, {
                    update_id: ctx.update.update_id,
                    message: {
                        message_id: ctx.message.message_id,
                        from: ctx.from,
                        chat: ctx.chat,
                        date: ctx.message.date,
                        document: ctx.message.document,
                        caption: ctx.message.caption
                    },
                    type: 'document_message',
                    chat_id: chatId,
                    from: ctx.from,
                    document: ctx.message.document
                });

                // Ответ обрабатывается через n8n

                this.emit('message:received', {
                    customerId,
                    chatId,
                    type: 'document',
                    fileName
                });
            } catch (error) {
                console.error(`❌ Error handling document for customer ${username}:`, error);
                // Ошибки обрабатываются через n8n
            }
        });

        // Универсальный обработчик для всех остальных типов сообщений
        bot.on('message', async (ctx) => {
            await this.handleIncomingMessage(customerId, ctx);

            const chatId = ctx.chat.id.toString();
            const messageType = getMessageType(ctx.message);

            // Пропускаем уже обработанные типы
            if (['text', 'photo', 'document'].includes(messageType)) {
                return;
            }

            console.log(`📨 ${messageType} message received in chat ${chatId} for customer ${username}`);

            try {
                // Приводим ctx.message к any для доступа к специфичным полям
                const message: any = ctx.message;

                // Отправляем Update на webhook для всех остальных типов
                await this.sendToWebhook(customerId, {
                    update_id: ctx.update.update_id,
                    message: {
                        message_id: message.message_id,
                        from: ctx.from,
                        chat: ctx.chat,
                        date: message.date,
                        // Добавляем специфичные поля в зависимости от типа
                        ...(message.video && { video: message.video }),
                        ...(message.audio && { audio: message.audio }),
                        ...(message.voice && { voice: message.voice }),
                        ...(message.video_note && { video_note: message.video_note }),
                        ...(message.sticker && { sticker: message.sticker }),
                        ...(message.animation && { animation: message.animation }),
                        ...(message.location && { location: message.location }),
                        ...(message.contact && { contact: message.contact }),
                        ...(message.poll && { poll: message.poll }),
                        ...(message.dice && { dice: message.dice }),
                        ...(message.caption && { caption: message.caption })
                    },
                    type: `${messageType}_message`,
                    chat_id: chatId,
                    from: ctx.from
                });

                // Ответ обрабатывается через n8n

                this.emit('message:received', {
                    customerId,
                    chatId,
                    type: messageType,
                    from: ctx.from
                });
            } catch (error) {
                console.error(`❌ Error handling ${messageType} for customer ${username}:`, error);
                // Ошибки обрабатываются через n8n
            }
        });

        // Обработчик ошибок бота
        bot.catch((err: any, ctx: any) => {
            console.error(`❌ Bot error for customer ${username}:`, err);
            this.emit('bot:message:error', { customerId, username, error: err, ctx });
        });
    }

    // Простая обработка сообщений пользователя - только сохранение
    private async handleUserMessage(ctx: any, user: any, text: string, customerId: string, username: string) {
        const chatId = ctx.chat.id.toString();

        try {
            // Просто сохраняем сообщение в базу, state управляется через API
            await User.findByIdAndUpdate(
              user._id,
              {
                  $push: {
                      messages: `${new Date().toISOString()}: ${text}`
                  }
              },
              { new: true }
            );

            // Основная работа - это отправка на webhook, которая происходит выше
            console.log(`💾 Message saved for user ${chatId} from customer ${username}`);

        } catch (error) {
            console.error(`❌ Error saving message for user ${chatId}:`, error);
        }
    }

    // Запуск прослушивания входящих сообщений для бота
    private async startBotListening(botInstance: BotInstance) {
        if (botInstance.isListening) {
            console.log(`⚡ Bot for ${botInstance.username} is already listening`);
            return;
        }

        try {
            // Запускаем бота в режиме polling БЕЗ await чтобы не блокировать выполнение
            console.log(`📡 Launching bot polling for ${botInstance.username}...`);

            // Запускаем polling асинхронно, не ждем завершения
            botInstance.bot.launch().then(() => {
                console.log(`✅ Bot polling started successfully for ${botInstance.username}`);
                botInstance.isListening = true;

                console.log(`👂 Bot started listening for customer: ${botInstance.username}`);
                this.emit('bot:listening:started', {
                    customerId: botInstance.customerId,
                    username: botInstance.username
                });
            }).catch((error) => {
                console.error(`❌ Failed to start listening for customer ${botInstance.username}:`, error);
                botInstance.status = 'error';
                this.emit('bot:listening:error', {
                    customerId: botInstance.customerId,
                    username: botInstance.username,
                    error
                });
            });

            // Сразу помечаем как запускающийся
            botInstance.isListening = true;
            console.log(`🚀 Bot launch initiated for ${botInstance.username} (non-blocking)`);

        } catch (error) {
            console.error(`❌ Failed to initiate bot launch for customer ${botInstance.username}:`, error);
            botInstance.status = 'error';
            this.emit('bot:listening:error', {
                customerId: botInstance.customerId,
                username: botInstance.username,
                error
            });
        }
    }

    // Остановка прослушивания для бота
    private async stopBotListening(botInstance: BotInstance) {
        if (!botInstance.isListening) {
            return;
        }

        try {
            await botInstance.bot.stop();
            botInstance.isListening = false;

            console.log(`🔇 Bot stopped listening for customer: ${botInstance.username}`);
            this.emit('bot:listening:stopped', {
                customerId: botInstance.customerId,
                username: botInstance.username
            });
        } catch (error) {
            console.error(`❌ Error stopping bot for customer ${botInstance.username}:`, error);
        }
    }

    // Добавляем нового бота
    private async addBot(customerId: string, username: string, token: string): Promise<boolean> {
        if (this.bots.has(customerId)) {
            console.log(`🔄 Updating existing bot for customer: ${username}`);
            return await this.updateBot(customerId, username, token);
        }

        try {
            console.log(`🔧 Creating Telegraf instance for ${username} with token: ${token.substring(0, 10)}...`);
            const bot = new Telegraf(token);

            // Проверяем валидность бота
            console.log(`🔍 Checking bot validity for ${username}...`);
            const botInfo = await bot.telegram.getMe();
            console.log(`✅ Bot info received: @${botInfo.username} for customer ${username}`);

            const botInstance: BotInstance = {
                bot,
                customerId,
                username,
                token,
                status: 'active',
                lastUpdated: new Date(),
                isListening: false
            };

            // Настраиваем обработчики входящих сообщений
            console.log(`🎛️ Setting up bot handlers for ${username}...`);
            this.setupBotHandlers(bot, customerId, username);

            this.bots.set(customerId, botInstance);
            console.log(`💾 Bot instance saved to cache for ${username}`);

            // Запускаем прослушивание входящих сообщений
            console.log(`🚀 Starting bot listening for ${username}...`);
            this.startBotListening(botInstance); // Убираем await, чтобы не блокировать

            console.log(`✅ Bot added for customer: ${username} (@${botInfo.username})`);
            this.emit('bot:added', { customerId, username, botUsername: botInfo.username });

            return true;
        } catch (error) {
            console.error(`❌ Failed to add bot for customer ${username}:`, error);

            // Добавляем неактивного бота для отслеживания
            const botInstance: BotInstance = {
                bot: new Telegraf(token), // Создаем, но помечаем как ошибочный
                customerId,
                username,
                token,
                status: 'error',
                lastUpdated: new Date(),
                isListening: false
            };

            this.bots.set(customerId, botInstance);
            this.emit('bot:error', { customerId, username, error });

            return false;
        }
    }

    // Обновляем существующего бота
    private async updateBot(customerId: string, username: string, newToken: string): Promise<boolean> {
        const existingBot = this.bots.get(customerId);

        if (!existingBot) {
            return await this.addBot(customerId, username, newToken);
        }

        // Если токен не изменился, ничего не делаем
        if (existingBot.token === newToken) {
            console.log(`⚡ Token unchanged for customer: ${username}`);
            return true;
        }

        try {
            // Останавливаем старого бота
            await this.stopBotListening(existingBot);

            // Создаем новый экземпляр бота с новым токеном
            const newBot = new Telegraf(newToken);
            const botInfo = await newBot.telegram.getMe();

            // Настраиваем обработчики для нового бота
            this.setupBotHandlers(newBot, customerId, username);

            // Обновляем данные
            existingBot.bot = newBot;
            existingBot.token = newToken;
            existingBot.username = username;
            existingBot.status = 'active';
            existingBot.lastUpdated = new Date();
            existingBot.isListening = false;

            // Запускаем прослушивание для нового бота
            this.startBotListening(existingBot); // Убираем await

            console.log(`🔄 Bot updated for customer: ${username} (@${botInfo.username})`);
            this.emit('bot:updated', { customerId, username, botUsername: botInfo.username });

            return true;
        } catch (error) {
            console.error(`❌ Failed to update bot for customer ${username}:`, error);

            // Обновляем статус на ошибку
            existingBot.status = 'error';
            existingBot.lastUpdated = new Date();

            this.emit('bot:error', { customerId, username, error });
            return false;
        }
    }

    // Удаляем бота
    private async removeBot(customerId: string) {
        const botInstance = this.bots.get(customerId);
        if (botInstance) {
            // Останавливаем прослушивание перед удалением
            await this.stopBotListening(botInstance);

            this.bots.delete(customerId);
            console.log(`🗑️ Bot removed for customer: ${botInstance.username}`);
            this.emit('bot:removed', { customerId, username: botInstance.username });
        }
    }

    // НОВЫЙ ПУБЛИЧНЫЙ МЕТОД для обновления подписки
    async updateSubscription(customerId: string, newStatus: 'active' | 'inactive' | 'expired', endsAt?: Date) {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            console.error(`Customer with ID ${customerId} not found for subscription update.`);
            return { success: false, message: 'Customer not found' };
        }

        customer.subscriptionStatus = newStatus;
        if (endsAt) {
            customer.subscriptionEndsAt = endsAt;
        } else if (newStatus === 'active') {
            // По умолчанию даем подписку на 30 дней, если дата не указана
            const newEndsAt = new Date();
            newEndsAt.setDate(newEndsAt.getDate() + 30);
            customer.subscriptionEndsAt = newEndsAt;
        }

        await customer.save(); // Это вызовет наш post-save hook и обновит состояние бота

        return { success: true, customer };
    }

    // Обработчик изменений от Mongoose middleware
    async handleCustomerChange(operation: 'save' | 'update' | 'delete', customer: any) {
        try {
            const customerId = customer._id.toString();
            const username = customer.username;
            const botToken = customer.botToken;
            const isSubscriptionActive = customer.subscriptionStatus === 'active' && customer.subscriptionEndsAt && customer.subscriptionEndsAt > new Date();

            console.log(`📡 Customer change detected: ${operation} for ${username}. Subscription active: ${isSubscriptionActive}`);

            const existingBot = this.bots.get(customerId);

            if (operation === 'delete') {
                await this.removeBot(customerId);
                return;
            }

            if (botToken && isSubscriptionActive) {
                // Если подписка активна и есть токен
                if (existingBot) {
                    await this.updateBot(customerId, username, botToken);
                } else {
                    await this.addBot(customerId, username, botToken);
                }
            } else {
                // Если подписка неактивна или нет токена
                if (existingBot) {
                    await this.removeBot(customerId);
                }
            }

        } catch (error) {
            console.error('❌ Error handling customer change:', error);
            this.emit('change:error', { error, operation, customer });
        }
    }

    // Получаем бота по customerId
    getBot(customerId: string): Telegraf | null {
        const botInstance = this.bots.get(customerId);
        return botInstance?.status === 'active' ? botInstance.bot : null;
    }

    // Получаем информацию о боте
    getBotInfo(customerId: string): BotInstance | null {
        return this.bots.get(customerId) || null;
    }

    // Получаем всех ботов
    getAllBots(): Map<string, BotInstance> {
        return new Map(this.bots);
    }

    // Получаем статистику
    getStats() {
        const stats = {
            total: this.bots.size,
            active: 0,
            inactive: 0,
            error: 0,
            listening: 0,
            isWatching: false, // Mongoose middleware не требует watching
            method: 'mongoose-middleware'
        };

        for (const bot of this.bots.values()) {
            stats[bot.status]++;
            if (bot.isListening) stats.listening++;
        }

        return stats;
    }

    // Дополнительный метод для периодической синхронизации (fallback)
    async syncWithDatabase() {
        console.log('🔄 Syncing BotManager with database...');

        try {
            const customers = await Customer.find({}, 'username botToken _id updatedAt');
            const currentBots = new Set(this.bots.keys());
            const dbCustomers = new Set<string>();

            for (const customer of customers) {
                const customerId = (customer._id as any).toString();
                dbCustomers.add(customerId);

                const existingBot = this.bots.get(customerId);

                if (!existingBot) {
                    // Новый кастомер
                    if (customer.botToken) {
                        await this.addBot(customerId, customer.username, customer.botToken);
                    }
                } else {
                    // Проверяем, изменился ли токен
                    if (customer.botToken !== existingBot.token) {
                        if (customer.botToken) {
                            await this.updateBot(customerId, customer.username, customer.botToken);
                        } else {
                            await this.removeBot(customerId);
                        }
                    }
                }
            }

            // Удаляем ботов для несуществующих кастомеров
            for (const customerId of currentBots) {
                if (!dbCustomers.has(customerId)) {
                    await this.removeBot(customerId);
                }
            }

            console.log(`✅ Database sync completed. Total bots: ${this.bots.size}`);
            this.emit('manager:synced', { botsCount: this.bots.size });

        } catch (error) {
            console.error('❌ Error syncing with database:', error);
            this.emit('sync:error', { error });
        }
    }

    // Отправка сообщения через конкретного бота
    async sendMessage(
        customerId: string,
        chatId: string,
        message: string,
        showWantButton: boolean = false,
        showCorrectButton: boolean = false,
        removeKeyboard: boolean = false,
        parse_mode: "HTML" | "Markdown" | "MarkdownV2" | undefined = undefined
    ): Promise<{ success: boolean; error?: string; message?: IMessage }> {
        const bot = this.getBot(customerId);
        const botInfo = this.getBotInfo(customerId);

        if (!bot || !botInfo) {
            return {
                success: false,
                error: botInfo?.status === 'error'
                  ? `Bot for customer ${botInfo.username} is in error state`
                  : 'Bot not found'
            };
        }

        try {
            const options: any = {
                parse_mode,
            };

            if (removeKeyboard) {
                options.reply_markup = { remove_keyboard: true };
            } else if (showWantButton) {
                options.reply_markup = {
                    keyboard: [[{ text: 'Хочу' }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                };
            } else if (showCorrectButton) {
                options.reply_markup = {
                    keyboard: [[{ text: 'Верно' }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                };
            }

            const result = await bot.telegram.sendMessage(chatId, message, options);

            // Сохраняем исходящее сообщение
            const chat = await Chat.findOne({ customerId, chatId });
            if (chat) {
                const savedMessage = await this.saveMessage({
                    chat,
                    customerId,
                    messageId: result.message_id.toString(),
                    type: 'text',
                    direction: 'out',
                    content: { text: message }
                }); 
            }

            this.emit('message:sent', {
                customerId,
                chatId,
                messageLength: message.length,
                hasButton: showWantButton || showCorrectButton,
                hasWantButton: showWantButton,
                hasCorrectButton: showCorrectButton,
                removedKeyboard: removeKeyboard,
            });

            return { success: true };
        } catch (error: any) {
            console.error(`❌ Failed to send message via bot for customer ${botInfo.username}:`, error);

            this.emit('message:failed', {
                customerId,
                chatId,
                error,
            });

            return {
                success: false,
                error: error.message || 'Unknown error',
            };
        }
    }

    // Отправка файла через конкретного бота
    async sendFile(
        customerId: string,
        chatId: string,
        filePath: string,
        caption?: string,
        showWantButton: boolean = false,
        showCorrectButton: boolean = false,
        removeKeyboard: boolean = false,
        parse_mode: "HTML" | "Markdown" | "MarkdownV2" | undefined = undefined
    ): Promise<{ success: boolean; error?: string; message?: IMessage }> {
        const bot = this.getBot(customerId);
        const botInfo = this.getBotInfo(customerId);

        if (!bot || !botInfo) {
            return {
                success: false,
                error: botInfo?.status === 'error'
                  ? `Bot for customer ${botInfo.username} is in error state`
                  : 'Bot not found'
            };
        }

        try {
            const options: any = {
                parse_mode,
            };

            if (removeKeyboard) {
                options.reply_markup = { remove_keyboard: true };
            } else if (showWantButton) {
                options.reply_markup = {
                    keyboard: [[{ text: 'Хочу' }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                };
            } else if (showCorrectButton) {
                options.reply_markup = {
                    keyboard: [[{ text: 'Верно' }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                };
            }

            // Отправляем файл как документ
            const result = await bot.telegram.sendDocument(chatId, { source: filePath }, options);

            // Сохраняем исходящее сообщение
            const chat = await Chat.findOne({ customerId, chatId });
            if (chat) {
                const savedMessage = await this.saveMessage({
                    chat,
                    customerId,
                    messageId: result.message_id.toString(),
                    type: 'document',
                    direction: 'out',
                    content: { 
                        document: {
                            file_name: filePath.split('/').pop() || 'unknown',
                            file_path: filePath
                        },
                        caption: caption || ''
                    }
                }); 
            }

            this.emit('file:sent', {
                customerId,
                chatId,
                filePath,
                caption: caption || '',
                hasButton: showWantButton || showCorrectButton,
                hasWantButton: showWantButton,
                hasCorrectButton: showCorrectButton,
                removedKeyboard: removeKeyboard,
            });

            return { success: true };
        } catch (error: any) {
            console.error(`❌ Failed to send file via bot for customer ${botInfo.username}:`, error);

            this.emit('file:failed', {
                customerId,
                chatId,
                filePath,
                error,
            });

            return {
                success: false,
                error: error.message || 'Unknown error',
            };
        }
    }

    async getChatHistory(customerId: string, chatId: string, limit = 50): Promise<IMessage[]> {
        const chat = await Chat.findOne({ customerId, chatId });
        if (!chat) return [];

        return Message.find({ chatId: chat._id })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate('chatId');
    }

    async getChats(customerId: string, limit = 20): Promise<IChat[]> {
        return Chat.find({ customerId })
            .sort({ 'meta.lastMessageAt': -1 })
            .limit(limit);
    }

    // Проверка статуса бота
    async checkBotStatus(customerId: string): Promise<{ success: boolean; botInfo?: any; error?: string }> {
        const bot = this.getBot(customerId);
        const botInstance = this.getBotInfo(customerId);

        if (!bot || !botInstance) {
            return { success: false, error: 'Bot not found or inactive' };
        }

        try {
            const botInfo = await bot.telegram.getMe();
            return {
                success: true,
                botInfo: {
                    ...botInfo,
                    isListening: botInstance.isListening,
                    status: botInstance.status
                }
            };
        } catch (error: any) {
            return { success: false, error: error.message || 'Unknown error' };
        }
    }

    // Остановка сервиса
    async stop() {
        console.log('🛑 Stopping BotManager...');

        // Останавливаем всех ботов
        for (const botInstance of this.bots.values()) {
            await this.stopBotListening(botInstance);
        }

        this.bots.clear();
        console.log('🛑 BotManager stopped');
        this.emit('manager:stopped');
    }

    // Принудительная перезагрузка всех ботов
    async reload() {
        console.log('🔄 Reloading all bots...');

        // Останавливаем всех ботов
        for (const botInstance of this.bots.values()) {
            await this.stopBotListening(botInstance);
        }

        this.bots.clear();
        await this.loadAllBots();
        console.log(`✅ Reloaded ${this.bots.size} bots`);
        this.emit('manager:reloaded', { botsCount: this.bots.size });
    }
}

// Экспортируем singleton
export const botManager = new BotManager();
export default botManager;
