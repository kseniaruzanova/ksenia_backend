import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import User from '../models/user.model';
import { botManager } from './botManager.service';
import mongoose from 'mongoose';
import { toArcana } from '../utils/sendBirthdayMessages';

interface BirthdayMessagingConfig {
    enabled: boolean;
    time: string; // Время в формате "HH:MM" (например, "09:00")
    timezone: string; // Часовой пояс (например, "Europe/Moscow")
}

interface BirthdayUser {
    customerId: string;
    chatId: string;
    customerName: string;
    birthday: string;
}

class BirthdayMessagingService extends EventEmitter {
    private config: BirthdayMessagingConfig;
    private cronJob: cron.ScheduledTask | null = null;
    private isRunning: boolean = false;
    private lastSentDate: string | null = null;

    constructor() {
        super();
        this.config = {
            enabled: false,
            time: '09:00', // 9 утра по умолчанию
            timezone: 'Europe/Moscow' // Московское время по умолчанию
        };
        console.log('🎂 BirthdayMessagingService initialized');
    }

    /**
     * Получить всех пользователей с указанной датой рождения
     */
    async getUsersWithBirthday(): Promise<BirthdayUser[]> {
        try {
            // Ищем всех пользователей, у которых указана дата рождения (не пустая)
            const users = await User.find({
                birthday: { $exists: true, $nin: [null, ''] }
            }, 'chat_id customerId birthday')
                .populate('customerId', 'username')
                .lean();

            const result: BirthdayUser[] = users.map((user: any) => ({
                customerId: user.customerId?._id?.toString() ?? '',
                chatId: user.chat_id,
                customerName: user.customerId?.username ?? 'Unknown',
                birthday: user.birthday
            }));

            console.log(`🎂 Found ${result.length} users with birthday`);
            return result;
        } catch (error) {
            console.error('❌ Error getting users with birthday:', error);
            throw error;
        }
    }
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
     * Создать простое сообщение с датой рождения пользователя
     */
    async generateBirthdayMessage(user: BirthdayUser): Promise<string> {
        try {
            const getDigitSum = (dateStr: string) => dateStr.split('.').reduce((sum: number, part: string) => 
                sum + part.split('').reduce((s, d) => s + +d, 0), 0
            );
            
            const today = new Date().toLocaleDateString('ru-RU');
            const numb1 = toArcana(getDigitSum(user.birthday));
            const numb2 = toArcana(getDigitSum(today));
            const sum12 = toArcana(numb1 + numb2);
            
            const arcan = [
                numb2, 
                sum12, 
                toArcana(numb1 + sum12), 
                toArcana(numb2 + sum12), 
                toArcana(sum12 + toArcana(numb1 + sum12) + toArcana(numb2 + sum12))
            ];
            const prompt = {
                model: "openai/gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Ты опытный таролог, работающий с системой Таро Тота Алистера Кроули. Твоя задача - составить точную и полезную характеристику дня на основе 5 старших арканов.
            
            ИНСТРУКЦИЯ:
            - В начале ответа обязательно сделай приветствие с указанием даты рождения пользователя (${user.birthday}) и сегодняшней даты (${today}).
            - Анализируй каждый аркан глубоко, учитывая его традиционные значения и специфику системы Кроули. 
            - Давай сбалансированную характеристику, показывая как позитивные, так и challenging аспекты.
            
            СТРУКТУРА ОТВЕТА:
            
            👋 ПРИВЕТСТВИЕ  
               - Укажи дату рождения пользователя (${user.birthday}) и сегодняшнюю дату (${today}).
            
            1. ЭНЕРГИЯ ДНЯ (на основе Аркана ${arcan[0]})
               - 📈 Потенциал дня: какие возможности и благоприятные энергии несет этот аркан
               - ⚠️ Вызовы дня: какие сложности или предостережения связаны с этой энергией
               - 🔍 Ключевой фокус: на что особенно обратить внимание сегодня
            
            2. ТЕМЫ И СОБЫТИЯ (на основе Аркана ${arcan[1]})
               - 💫 Вероятные ситуации: какие события могут проявиться под влиянием этого аркана
               - 🎭 Позитивное развитие: как эти темы могут раскрыться благоприятно
               - 🌪️ Сложные аспекты: какие трудности могут возникнуть в этих сферах
            
            3. ЭМОЦИОНАЛЬНОЕ СОСТОЯНИЕ (на основе синтеза Арканов ${arcan[2]} и ${arcan[3]})
               - ❤️ Доминирующие чувства: опиши эмоциональный фон от сочетания этих арканов
               - 🌈 Позитивные эмоции: какие светлые чувства могут проявиться
               - ☁️ Эмоциональные вызовы: с какими переживаниями может столкнуться человек
               - ⚖️ Баланс: как гармонизировать влияние двух арканов
            
            4. СОВЕТ И СУТЬ ДНЯ (на основе Аркана ${arcan[4]})
               - 🧭 Главный урок: основное послание дня
               - 💡 Практический совет: конкретные рекомендации для действий
               - 🌟 Духовный смысл: более глубокое понимание происходящего
            
            ТОН И СТИЛЬ:
            - Профессионально, но доступно
            - Поддерживающий и вдохновляющий
            - Конкретный, без излишней абстракции
            - Баланс между эзотерической глубиной и практической применимостью
            
            ФОРМАТИРОВАНИЕ:
            Используй эмодзи для визуального разделения блоков, но не злоупотребляй ими.`
                    },
                    {
                        role: "user",
                        content: `Проанализируй расклад дня по следующим арканам Кроули:
            
            🎴 Аркан 1 (Энергия дня): ${arcan[0]}
            🎴 Аркан 2 (Темы дня): ${arcan[1]}  
            🎴 Аркан 3 (Эмоции, часть 1): ${arcan[2]}
            🎴 Аркан 4 (Эмоции, часть 2): ${arcan[3]}
            🎴 Аркан 5 (Совет дня): ${arcan[4]}
            
            Составь целостную характеристику дня.`
                    }
                ]
            };            

            const response = await this.sendRequestToVseGPT(prompt, process.env.VSE_GPT_API_KEY || '');
            return response.choices[0].message.content;
        } catch (error) {
            console.error('❌ Error generating birthday message:', error);
            return `🎂 С днем рождения, ${user.customerName}! Желаем вам всего самого лучшего! ✨`;
        }
    }

    /**
     * Отправить поздравление с днем рождения пользователю
     */
    async sendBirthdayMessage(user: BirthdayUser): Promise<{ success: boolean; error?: string }> {
        try {
            const birthdayMessage = await this.generateBirthdayMessage(user);
            
            console.log(`🎂 Sending birthday message to ${user.chatId} (${user.customerName}): "${birthdayMessage}"`);
            
            // Отправляем сообщение через BotManager
            const result = await botManager.sendMessage(user.customerId, user.chatId, birthdayMessage.replace("---", ''), false, false, false, "Markdown");
            
            if (result.success) {
                this.emit('birthday:sent', { 
                    customerId: user.customerId, 
                    chatId: user.chatId, 
                    customerName: user.customerName,
                    message: birthdayMessage
                });
                console.log(`✅ Birthday message sent to ${user.chatId} (${user.customerName})`);
            } else {
                this.emit('birthday:failed', { 
                    customerId: user.customerId, 
                    chatId: user.chatId, 
                    customerName: user.customerName,
                    error: result.error 
                });
                console.error(`❌ Failed to send birthday message to ${user.chatId} (${user.customerName}): ${result.error}`);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Error sending birthday message to ${user.chatId}:`, error);
            this.emit('birthday:error', { customerId: user.customerId, chatId: user.chatId, customerName: user.customerName, error: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Отправить поздравления всем пользователям с днем рождения
     */
    async sendBirthdayMessagesToAll(): Promise<{
        total: number;
        success: number;
        failed: number;
        results: Array<{ customerId: string; chatId: string; customerName: string; success: boolean; error?: string }>;
    }> {
        try {
            console.log('🎂 Starting birthday messaging to all users...');
            
            const users = await this.getUsersWithBirthday();
            const results = [];
            let successCount = 0;
            let failedCount = 0;

            // Отправляем сообщения с задержкой между ними
            for (const user of users) {
                const result = await this.sendBirthdayMessage(user);
                
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

                // Задержка между отправками (200мс)
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const summary = {
                total: users.length,
                success: successCount,
                failed: failedCount,
                results
            };

            console.log(`🎂 Birthday messaging completed: ${successCount}/${users.length} successful`);
            this.emit('birthday:completed', summary);

            return summary;
        } catch (error) {
            console.error('❌ Error in sendBirthdayMessagesToAll:', error);
            this.emit('birthday:error', { error });
            throw error;
        }
    }

    /**
     * Запустить планировщик ежедневных поздравлений
     */
    startBirthdayScheduler(): void {
        if (this.isRunning) {
            console.log('⚠️ Birthday messaging scheduler is already running');
            return;
        }

        if (!this.config.enabled) {
            console.log('⏸️ Birthday messaging is disabled, scheduler not started');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Starting birthday messaging scheduler...');

        // Создаем cron выражение для ежедневного выполнения в указанное время
        const [hours, minutes] = this.config.time.split(':');
        const cronExpression = `${minutes} ${hours} * * *`; // Каждый день в указанное время

        this.cronJob = cron.schedule(cronExpression, async () => {
            console.log('🎂 Cron job triggered - sending birthday messages...');
            try {
                await this.sendBirthdayMessagesToAll();
            } catch (error) {
                console.error('❌ Error in birthday cron job:', error);
            }
        }, {
            timezone: this.config.timezone
        });

        console.log(`⏰ Birthday messages scheduled for ${this.config.time} ${this.config.timezone}`);
        this.emit('scheduler:started');
    }

    /**
     * Остановить планировщик ежедневных поздравлений
     */
    stopBirthdayScheduler(): void {
        if (!this.isRunning) {
            console.log('⚠️ Birthday messaging scheduler is not running');
            return;
        }

        this.isRunning = false;

        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        console.log('🛑 Birthday messaging scheduler stopped');
        this.emit('scheduler:stopped');
    }

    /**
     * Обновить конфигурацию
     */
    updateConfig(newConfig: Partial<BirthdayMessagingConfig>): void {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        console.log('⚙️ Birthday messaging config updated:', {
            enabled: this.config.enabled,
            time: this.config.time,
            timezone: this.config.timezone
        });

        // Если изменился статус enabled, перезапускаем планировщик
        if (oldConfig.enabled !== this.config.enabled) {
            if (this.config.enabled) {
                this.startBirthdayScheduler();
            } else {
                this.stopBirthdayScheduler();
            }
        }

        this.emit('config:updated', { oldConfig, newConfig: this.config });
    }

    /**
     * Получить текущую конфигурацию
     */
    getConfig(): BirthdayMessagingConfig {
        return { ...this.config };
    }

    /**
     * Получить статус планировщика
     */
    getStatus(): {
        isRunning: boolean;
        enabled: boolean;
        time: string;
        timezone: string;
        lastSentDate: string | null;
    } {
        return {
            isRunning: this.isRunning,
            enabled: this.config.enabled,
            time: this.config.time,
            timezone: this.config.timezone,
            lastSentDate: this.lastSentDate
        };
    }

    /**
     * Принудительно отправить поздравления сейчас
     */
    async sendNow(): Promise<any> {
        console.log('🚀 Force sending birthday messages now...');
        return await this.sendBirthdayMessagesToAll();
    }
}

// Экспортируем singleton
export const birthdayMessagingService = new BirthdayMessagingService();
export default birthdayMessagingService;
