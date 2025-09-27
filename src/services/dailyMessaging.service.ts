import { EventEmitter } from 'events';
import User from '../models/user.model';
import { Message } from '../models/messages.model';
import { Chat } from '../models/chat.model';
import DailyMessageLog from '../models/dailyMessageLog.model';
import { botManager } from './botManager.service';
import mongoose from 'mongoose';

interface DailyMessagingConfig {
    enabled: boolean;
    minHour: number; // Минимальный час для отправки (0-23)
    maxHour: number; // Максимальный час для отправки (0-23)
}

class DailyMessagingService extends EventEmitter {
    private config: DailyMessagingConfig;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private lastSentDate: string | null = null;

    constructor() {
        super();
        this.config = {
            enabled: false,
            minHour: 9, // С 9 утра
            maxHour: 21, // До 9 вечера
        };
        console.log('📅 DailyMessagingService initialized');
    }

    /**
     * Получить пользователей по параметрам
     * @param customerId - ID кастомера (обязательно)
     * @param chatId - ID чата (опционально, если указан - ищет одного пользователя)
     */
    async getAllUsers(customerId?: string, chatId?: string): Promise<Array<{ customerId: string; chatId: string; customerName: string }>> {
        try {
            let query: any = {};
            
            if (customerId) {
                const mongoose = require('mongoose');
                query.customerId = new mongoose.Types.ObjectId(customerId);
            }
            
            if (chatId) {
                query.chat_id = chatId;
            }
            
            // Получаем пользователей по запросу
            const users = await User.find(query, 'chat_id customerId')
                .populate('customerId', 'username')
                .lean();
                
            console.log('Query:', query);
            console.log('Found users:', users.length);
            
            const result = users.map((user: any) => ({
                customerId: user.customerId?._id?.toString() ?? '',
                chatId: user.chat_id,
                customerName: user.customerId?.username ?? 'Unknown'
            }));
        
            console.log(`📊 Found ${result.length} users for daily messaging`);
            return result;
        } catch (error) {
            console.error('❌ Error getting users:', error);
            throw error;
        }
    }
      

    /**
     * Получить историю сообщений пользователя для генерации ответа
     */
    async getUserChatHistory(customerId: string, chatId: string): Promise<string[]> {
        try {
            // Преобразуем customerId в ObjectId для поиска
            const mongoose = require('mongoose');
            const customerObjectId = new mongoose.Types.ObjectId(customerId);
            
            const chat = await Chat.findOne({ customerId: customerObjectId, chatId });
            if (!chat) {
                return [];
            }

            const messages = await Message.find({ chatId: chat._id })
                .sort({ timestamp: -1 })
                .lean();

            // Извлекаем только текстовые сообщения от пользователя
            const userMessages = messages
                .filter(msg => msg.direction === 'in' && msg.content?.text)
                .map(msg => msg.content.text)
                .filter((text): text is string => text !== undefined)

            return userMessages;
        } catch (error) {
            console.error(`❌ Error getting chat history for ${chatId}:`, error);
            return [];
        }
    }

    /**
     * Получить историю отправленных сообщений для пользователя
     */
    async getSentMessagesHistory(customerId: string, chatId: string, limit: number = 10): Promise<string[]> {
        try {
            const customerObjectId = new mongoose.Types.ObjectId(customerId);
            
            const logs = await DailyMessageLog.find({ 
                customerId: customerObjectId, 
                chatId 
            })
            .sort({ sentAt: -1 })
            .limit(limit)
            .lean();

            return logs.map(log => log.message);
        } catch (error) {
            console.error(`❌ Error getting sent messages history for ${chatId}:`, error);
            return [];
        }
    }

    /**
     * Сохранить лог отправленного сообщения
     */
    async saveSentMessageLog(
        customerId: string, 
        chatId: string, 
        message: string, 
        userMessages: string[]
    ): Promise<void> {
        try {
            const customerObjectId = new mongoose.Types.ObjectId(customerId);
            
            await DailyMessageLog.create({
                customerId: customerObjectId,
                chatId,
                message,
                userMessages,
                sentAt: new Date()
            });

            console.log(`📝 Saved message log for ${chatId}`);
        } catch (error) {
            console.error(`❌ Error saving message log for ${chatId}:`, error);
        }
    }

    // Функция отправляет запрос на внешний сервер с передачей API ключа и JSON тела
    // Для асинхронного запроса используется fetch (или axios, если fetch недоступен)
    // Здесь пример с fetch (node-fetch или глобальный fetch в Node 18+)
    // ВАЖНО: импорт fetch должен быть вверху файла, если требуется (например, import fetch from 'node-fetch';)

    // Пример использования:
    // const response = await this.sendRequestToServer('https://example.com/api', { key: 'value' }, 'YOUR_API_KEY');

    async sendRequestToVseGPT(data: any, apiKey: string): Promise<any> {
        try {
            const response = await fetch("https://api.vsegpt.ru/v1/chat/completions", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Error sending request to server:', error);
            throw error;
        }
    }

    /**
     * Сгенерировать персонализированное сообщение на основе истории чата
     */
    async generatePersonalizedMessage(userMessages: string[], customerId: string, chatId: string): Promise<string> {
        if (userMessages.length === 0) {
            const tarotInvitations = [
                "🔮 Карты таро шепчут ваше имя... Готовы узнать, что скрывают звезды?",
                "✨ Вселенная приготовила для вас особое послание. Хотите его услышать?",
                "🌙 Луна сегодня особенно яркая... Может быть, пора узнать свою судьбу?",
                "🌟 Звезды выстроились в особый узор именно для вас. Интересно узнать что это означает?",
                "🔮 Таро карты ждут вашего вопроса... Что вас больше всего волнует сегодня?",
                "✨ Энергия вселенной сегодня особенно сильна. Готовы получить ответы на свои вопросы?",
                "🌙 Карты готовы раскрыть тайны вашего будущего. О чем бы вы хотели узнать?",
                "🌟 Судьба приготовила для вас важное послание. Хотите его прочитать?",
                "🔮 Таро карты зовут вас в путешествие по лабиринтам судьбы. Готовы начать?",
                "✨ Сегодня особенный день для гаданий. Что вас интересует больше всего?"
            ];
            
            const randomIndex = Math.floor(Math.random() * tarotInvitations.length);
            return tarotInvitations[randomIndex];
        }

        try {
            // Получаем историю отправленных сообщений
            const sentMessagesHistory = await this.getSentMessagesHistory(customerId, chatId, 5);
            
            console.log('User messages:', userMessages.join(', '));
            console.log('Sent messages history:', sentMessagesHistory.join(', '));
            
            const prompt = {
                model: "openai/gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: `Ты — девушка 👩, лёгкий и дружеский собеседник. 
              Определи пол собеседника по истории его сообщений и пиши вопросы в нужной форме ("Ты говорил..." или "Ты писала...").  
              
              Твоя задача: взять одну случайную тему из последних сообщений пользователя и задать по ней короткий вопрос. 
              Вопрос должен быть таким, чтобы на него можно было ответить "да" или "нет".  
              
              Формат вопроса:
              - Начало с отсылкой к сообщению пользователя ("Ты говорил про ...", "Помню, ты писал про ...", "Ты упоминал про ..."). 
              - Затем простой уточняющий вопрос ("... удалось?", "... получилось?", "... это ещё актуально?", "... ты доволен?").  
              
              Правила:
              - Лёгкий, дружеский тон.  
              - Только один вопрос.  
              - Не упоминай карму, эзотерику, мистику.  
              - Не повторяй вопросы, которые уже задавались ранее (список ниже).  
              - Выводи только сам вопрос, без пояснений или лишнего текста.`
                  },
                  {
                    role: "user",
                    content: `Последние сообщения пользователя: ${userMessages.join(', ')}
              
              Ранее отправленные вопросы (НЕ повторяй их):
              ${sentMessagesHistory.length > 0 ? sentMessagesHistory.join('\n') : 'Нет предыдущих вопросов'}`
                  }
                ]
              };
              
                                                   
              

            const response = await this.sendRequestToVseGPT(prompt, process.env.VSE_GPT_API_KEY || '');
            return response.choices[0].message.content;
        } catch (error) {
            console.error('❌ Error generating AI message, using fallback:', error);
            
            const tarotInvitations = [
                "🔮 Карты таро шепчут ваше имя... Готовы узнать, что скрывают звезды?",
                "✨ Вселенная приготовила для вас особое послание. Хотите его услышать?",
                "🌙 Луна сегодня особенно яркая... Может быть, пора узнать свою судьбу?"
            ];
            
            const randomIndex = Math.floor(Math.random() * tarotInvitations.length);
            return tarotInvitations[randomIndex];
        }
    }

    /**
     * Отправить персонализированное сообщение пользователю
     */
    async sendPersonalizedMessage(
        customerId: string, 
        chatId: string, 
        customerName: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Получаем историю сообщений пользователя
            const userMessages = await this.getUserChatHistory(customerId, chatId);
            
            // Генерируем персонализированное сообщение
            const personalizedMessage = await this.generatePersonalizedMessage(userMessages, customerId, chatId);
            
            console.log(`📨 Sending personalized message to ${chatId} (${customerName}): "${personalizedMessage}"`);
            
            // Отправляем сообщение через BotManager
            const result = await botManager.sendMessage(customerId, chatId, personalizedMessage);
            
            if (result.success) {
                // Сохраняем лог отправленного сообщения
                await this.saveSentMessageLog(customerId, chatId, personalizedMessage, userMessages);
                
                this.emit('message:sent', { 
                    customerId, 
                    chatId, 
                    customerName, 
                    message: personalizedMessage,
                    userMessagesCount: userMessages.length
                });
                console.log(`✅ Personalized message sent to ${chatId} (${customerName})`);
            } else {
                this.emit('message:failed', { 
                    customerId, 
                    chatId, 
                    customerName, 
                    error: result.error 
                });
                console.error(`❌ Failed to send message to ${chatId} (${customerName}): ${result.error}`);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Error sending personalized message to ${chatId}:`, error);
            this.emit('message:error', { customerId, chatId, customerName, error: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Отправить ежедневные сообщения всем пользователям
     */
    async sendDailyMessagesToAllUsers(): Promise<{
        total: number;
        success: number;
        failed: number;
        results: Array<{ customerId: string; chatId: string; customerName: string; success: boolean; error?: string }>;
    }> {
        try {
            console.log('📅 Starting daily messaging to all users...');
            
            const users = await this.getAllUsers(); // Без параметров - получаем всех пользователей
            const results = [];
            let successCount = 0;
            let failedCount = 0;

            // Отправляем сообщения с задержкой между ними
            for (const user of users) {
                const result = await this.sendPersonalizedMessage(
                    user.customerId, 
                    user.chatId, 
                    user.customerName
                );
                
                results.push({
                    customerId: user.customerId,
                    chatId: user.chatId,
                    customerName: user.customerName,
                    success: result.success,
                    error: result.error
                });

                if (result.success) {
                    successCount++;
                } else {
                    failedCount++;
                }

                // Задержка между отправками (100мс)
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const summary = {
                total: users.length,
                success: successCount,
                failed: failedCount,
                results
            };

            console.log(`📊 Daily messaging completed: ${successCount}/${users.length} successful`);
            this.emit('daily:completed', summary);

            return summary;
        } catch (error) {
            console.error('❌ Error in sendDailyMessagesToAllUsers:', error);
            this.emit('daily:error', { error });
            throw error;
        }
    }

    /**
     * Вычислить случайное время для отправки сегодня
     */
    private getRandomTimeToday(): Date {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Генерируем случайный час в заданном диапазоне
        const randomHour = Math.floor(
            Math.random() * (this.config.maxHour - this.config.minHour + 1) + this.config.minHour
        );
        
        // Генерируем случайные минуты (0-59)
        const randomMinutes = Math.floor(Math.random() * 60);
        
        const randomTime = new Date(today);
        randomTime.setHours(randomHour, randomMinutes, 0, 0);
        
        // Если время уже прошло сегодня, планируем на завтра
        if (randomTime <= now) {
            randomTime.setDate(randomTime.getDate() + 1);
        }
        
        return randomTime;
    }

    /**
     * Запустить ежедневный планировщик
     */
    startDailyScheduler(): void {
        if (this.isRunning) {
            console.log('⚠️ Daily messaging scheduler is already running');
            return;
        }

        if (!this.config.enabled) {
            console.log('⏸️ Daily messaging is disabled, scheduler not started');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Starting daily messaging scheduler...');

        // Планируем первое сообщение на случайное время
        this.scheduleNextDailyMessage();

        // Проверяем каждую минуту, не пора ли отправлять
        this.intervalId = setInterval(() => {
            this.checkDailySchedule();
        }, 60000); // Каждую минуту

        this.emit('scheduler:started');
    }

    /**
     * Остановить ежедневный планировщик
     */
    stopDailyScheduler(): void {
        if (!this.isRunning) {
            console.log('⚠️ Daily messaging scheduler is not running');
            return;
        }

        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        console.log('🛑 Daily messaging scheduler stopped');
        this.emit('scheduler:stopped');
    }

    /**
     * Запланировать следующее ежедневное сообщение
     */
    private scheduleNextDailyMessage(): void {
        const nextTime = this.getRandomTimeToday();
        console.log(`⏰ Next daily message scheduled for: ${nextTime.toISOString()}`);
        this.emit('message:scheduled', { nextTime });
    }

    /**
     * Проверить, не пора ли отправлять ежедневные сообщения
     */
    private async checkDailySchedule(): Promise<void> {
        const now = new Date();
        const today = now.toDateString();
        
        // Проверяем, не отправляли ли мы уже сегодня
        if (this.lastSentDate === today) {
            return;
        }

        const currentHour = now.getHours();
        
        // Проверяем, находимся ли мы в диапазоне времени для отправки
        if (currentHour >= this.config.minHour && currentHour <= this.config.maxHour) {
            // Проверяем случайность - отправляем с вероятностью 1/60 (раз в час в среднем)
            if (Math.random() < (1 / 60)) {
                console.log('🎲 Random trigger activated for daily messaging!');
                await this.sendDailyMessagesToAllUsers();
                this.lastSentDate = today;
                
                // Планируем следующее сообщение на завтра
                this.scheduleNextDailyMessage();
            }
        }
    }

    /**
     * Обновить конфигурацию
     */
    updateConfig(newConfig: Partial<DailyMessagingConfig>): void {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        console.log('⚙️ Daily messaging config updated:', {
            enabled: this.config.enabled,
            minHour: this.config.minHour,
            maxHour: this.config.maxHour
        });

        // Если изменился статус enabled, перезапускаем планировщик
        if (oldConfig.enabled !== this.config.enabled) {
            if (this.config.enabled) {
                this.startDailyScheduler();
            } else {
                this.stopDailyScheduler();
            }
        }

        this.emit('config:updated', { oldConfig, newConfig: this.config });
    }

    /**
     * Получить текущую конфигурацию
     */
    getConfig(): DailyMessagingConfig {
        return { ...this.config };
    }

    /**
     * Получить статус планировщика
     */
    getStatus(): {
        isRunning: boolean;
        enabled: boolean;
        lastSentDate: string | null;
        nextCheckTime: Date;
    } {
        return {
            isRunning: this.isRunning,
            enabled: this.config.enabled,
            lastSentDate: this.lastSentDate,
            nextCheckTime: new Date(Date.now() + 60000) // Следующая проверка через минуту
        };
    }

    /**
     * Принудительно отправить ежедневные сообщения сейчас
     */
    async sendNow(): Promise<any> {
        console.log('🚀 Force sending daily messages now...');
        return await this.sendDailyMessagesToAllUsers();
    }
}

// Экспортируем singleton
export const dailyMessagingService = new DailyMessagingService();
export default dailyMessagingService;
