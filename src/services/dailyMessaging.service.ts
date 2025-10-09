import * as cron from "node-cron";
import { EventEmitter } from "events";

import User from "../models/user.model";
import { DailyMessagingConfig, DailyUser } from "../interfaces/dailyMessaging";
import { toArcana } from "../utils/arcan";
import botManager from "./botManager.service";
import DailyMessagingConfigModel from "../models/dailyMessagingConfig.model";
import DailyMessagingRunModel from "../models/dailyMessagingRun.model";

class DailyMessagingService extends EventEmitter {
  private config: DailyMessagingConfig;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastSentDate: string | null = null;
  
  // Переменная для отладки и телеметрии распределения по минутам
  private static readonly MINUTES_IN_WINDOW: number = 60;

  constructor() {
    super();
    this.config = {
      enabled: false,
      time: '09:00', // 9 утра по умолчанию
      timezone: 'Europe/Moscow', // Московское время по умолчанию
      maxConcurrency: 3,
      perMessageDelayMs: 0,
      promptSystem: '',
      promptUserTemplate: '',
      model: 'openai/gpt-4o-mini',
      temperature: 0.7,
      sendFormat: 'Markdown'
    };
    console.log('📅 DailyMessagingService initialized');
  }

  /**
   * Инициализация конфигурации из базы данных
   */
  async initializeFromDatabase(): Promise<void> {
    try {
      const existing = await DailyMessagingConfigModel.findOne({ key: 'default' }).lean();
      if (!existing) {
        const defaults = {
          key: 'default',
          enabled: false,
          time: '09:00',
          timezone: 'Europe/Moscow',
          maxConcurrency: 3,
          perMessageDelayMs: 0,
          promptSystem: this.getDefaultSystemPrompt(),
          promptUserTemplate: this.getDefaultUserTemplate(),
          llmModel: 'openai/gpt-4o-mini',
          temperature: 0.7,
          sendFormat: 'Markdown' as const
        };
        await DailyMessagingConfigModel.create(defaults as any);
        this.config = { ...defaults } as DailyMessagingConfig;
      } else {
        this.config = {
          enabled: existing.enabled,
          time: existing.time,
          timezone: existing.timezone,
          maxConcurrency: existing.maxConcurrency,
          perMessageDelayMs: existing.perMessageDelayMs,
          promptSystem: existing.promptSystem,
          promptUserTemplate: existing.promptUserTemplate,
          model: (existing as any).llmModel,
          temperature: existing.temperature,
          sendFormat: existing.sendFormat as any
        };
      }
      console.log('⚙️ Loaded DailyMessaging config from DB');
    } catch (error) {
      console.error('❌ Failed to load DailyMessaging config from DB:', error);
    }
  }

  /**
   * Получить всех пользователей для ежедневной отправки расклада
   */
  async getUsersForMessaging(): Promise<DailyUser[]> {
    try {
      // Ищем всех пользователей, у которых указана дата рождения (не пустая)
      const users = await User.find({
        birthday: { $exists: true, $nin: [null, ''] }
      }, 'chat_id customerId birthday')
        .populate('customerId', 'username')
        .lean();

      const result: DailyUser[] = users.map((user: any) => ({
        customerId: user.customerId?._id?.toString() ?? '',
        chatId: user.chat_id,
        customerName: user.customerId?.username ?? 'Unknown',
        birthday: user.birthday
      }));

      console.log(`📅 Found ${result.length} users for daily messaging`);
      return result;
    } catch (error) {
      console.error('❌ Error getting users for daily messaging:', error);
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
   * Получить текущие час и минуту в указанном таймзоне
   */
  private getCurrentHourMinuteInTimezone(): { hour: number; minute: number; isoInTz: string } {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: this.config.timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
    const hour = parseInt(get('hour'), 10);
    const minute = parseInt(get('minute'), 10);
    const isoInTz = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`;
    return { hour, minute, isoInTz };
  }

  /**
   * Хеш для распределения пользователей по минутам окна (0-59)
   */
  private getMinuteBucketForUser(user: DailyUser): number {
    const key = `${user.customerId}:${user.chatId}`;
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash) + key.charCodeAt(i);
      hash = hash | 0;
    }
    const bucket = Math.abs(hash) % DailyMessagingService.MINUTES_IN_WINDOW;
    return bucket;
  }

  /**
   * Создать ежедневный расклад для пользователя
   */
  async generateDailyMessage(user: DailyUser): Promise<string | null> {
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
      
      const systemPrompt = (this.config as any).promptSystem && (this.config as any).promptSystem.length > 0
        ? (this.config as any).promptSystem as string
        : this.getDefaultSystemPrompt();

      const userTemplate = (this.config as any).promptUserTemplate && (this.config as any).promptUserTemplate.length > 0
        ? (this.config as any).promptUserTemplate as string
        : this.getDefaultUserTemplate();

      const filledUser = userTemplate
        .replace(/\{\{birthday\}\}/g, user.birthday)
        .replace(/\{\{today\}\}/g, today)
        .replace(/\{\{arcan0\}\}/g, String(arcan[0]))
        .replace(/\{\{arcan1\}\}/g, String(arcan[1]))
        .replace(/\{\{arcan2\}\}/g, String(arcan[2]))
        .replace(/\{\{arcan3\}\}/g, String(arcan[3]))
        .replace(/\{\{arcan4\}\}/g, String(arcan[4]));

      const filledSystem = systemPrompt
        .replace(/\{\{birthday\}\}/g, user.birthday)
        .replace(/\{\{today\}\}/g, today)
        .replace(/\{\{arcan0\}\}/g, String(arcan[0]))
        .replace(/\{\{arcan1\}\}/g, String(arcan[1]))
        .replace(/\{\{arcan2\}\}/g, String(arcan[2]))
        .replace(/\{\{arcan3\}\}/g, String(arcan[3]))
        .replace(/\{\{arcan4\}\}/g, String(arcan[4]));

      const model = (this.config as any).model || 'openai/gpt-4o-mini';
      const temperature = (this.config as any).temperature ?? 0.7;

      const prompt = {
        model,
        temperature,
        messages: [
          {
            role: "system",
            content: filledSystem
          },
          {
            role: "user",
            content: filledUser
          }
        ]
      };

      const response = await this.sendRequestToVseGPT(prompt, process.env.VSE_GPT_API_KEY || '');
      const message = this.sanitizeGenerated(response.choices[0].message.content, (this.config as any).sendFormat as any);
      return message;
    } catch (error) {
      console.error('❌ Error generating daily message:', error);
      return null;
    }
  }

  /**
   * Отправить ежедневный расклад пользователю
   */
  async sendDailyMessage(user: DailyUser): Promise<{ success: boolean; error?: string }> {
    try {
      const dailyMessage = await this.generateDailyMessage(user);
      if (!dailyMessage) {
        return { success: false, error: 'Failed to generate daily message' };
      }
      console.log(`📅 Sending daily message to ${user.chatId} (${user.customerName})`);
      
      const result = await botManager.sendMessage(
        user.customerId,
        user.chatId,
        dailyMessage,
        false,
        false,
        false,
        ((this.config as any).sendFormat as any) || "Markdown"
      );
      
      if (result.success) {
        this.emit('daily:sent', { 
          customerId: user.customerId, 
          chatId: user.chatId, 
          customerName: user.customerName,
          message: dailyMessage
        });
        console.log(`✅ Daily message sent to ${user.chatId} (${user.customerName})`);
      } else {
        this.emit('daily:failed', { 
          customerId: user.customerId, 
          chatId: user.chatId, 
          customerName: user.customerName,
          error: result.error 
        });
        console.error(`❌ Failed to send daily message to ${user.chatId} (${user.customerName}): ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error sending daily message to ${user.chatId}:`, error);
      this.emit('daily:error', { customerId: user.customerId, chatId: user.chatId, customerName: user.customerName, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Отправить ежедневные расклады всем пользователям
   */
  async sendDailyMessagesToAll(): Promise<{
    total: number;
    success: number;
    failed: number;
    results: Array<{ customerId: string; chatId: string; customerName: string; success: boolean; error?: string }>;
  }> {
    try {
      console.log('📅 Starting daily messaging to all users...');
      
      const users = await this.getUsersForMessaging();
      const results: Array<{ customerId: string; chatId: string; customerName: string; success: boolean; error?: string }> = [];
      let successCount = 0;
      let failedCount = 0;

      for (const user of users) {
        const result = await this.sendDailyMessage(user);
        
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

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const summary = {
        total: users.length,
        success: successCount,
        failed: failedCount,
        results
      };

      console.log(`📅 Daily messaging completed: ${successCount}/${users.length} successful`);
      this.emit('daily:completed', summary);

      return summary;
    } catch (error) {
      console.error('❌ Error in sendDailyMessagesToAll:', error);
      this.emit('daily:error', { error });
      throw error;
    }
  }

  /**
   * Отправка сообщений только для пользователей, чей bucket совпадает с текущей минутой
   */
  private async sendDailyMessagesForCurrentMinuteBucket(): Promise<void> {
    const { hour, minute, isoInTz } = this.getCurrentHourMinuteInTimezone();
    if (hour !== 9) {
      return;
    }

    const allUsers = await this.getUsersForMessaging();
    const bucketUsers = allUsers.filter(u => this.getMinuteBucketForUser(u) === minute);

    console.log(`🎯 ${bucketUsers.length}/${allUsers.length} users in minute bucket ${minute} at ${isoInTz} (${this.config.timezone})`);

    let successCount = 0;
    let failedCount = 0;

    // Пул воркеров с ограничением concurrency
    const concurrency = Math.max(1, this.config.maxConcurrency);
    const delayMs = Math.max(0, this.config.perMessageDelayMs);
    let index = 0;

    const worker = async () => {
      while (index < bucketUsers.length) {
        const current = index++;
        const user = bucketUsers[current];
        const result = await this.sendDailyMessage(user);
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
        }
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, bucketUsers.length) }, () => worker());
    await Promise.all(workers);

    console.log(`📊 Minute ${minute}: sent ${successCount} ok, ${failedCount} failed`);
    try {
      await DailyMessagingRunModel.create({
        startedAt: new Date(),
        finishedAt: new Date(),
        total: bucketUsers.length,
        success: successCount,
        failed: failedCount,
        successRate: bucketUsers.length > 0 ? successCount / bucketUsers.length : 0,
        results: [],
        trigger: 'scheduler'
      });
    } catch (e) {
      console.error('❌ Failed to save scheduler minute result:', e);
    }
  }

  /**
   * Запустить планировщик ежедневных раскладов
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

    // Запускаем крон каждую минуту в промежутке указанного времени (час) 00-59 указанной таймзоны
    const hour = Number((this.config.time || '09:00').split(':')[0] || 9);
    const cronExpression = `* ${hour} * * *`;

    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        await this.sendDailyMessagesForCurrentMinuteBucket();
      } catch (error) {
        console.error('❌ Error in daily minute cron job:', error);
      }
    }, {
      timezone: this.config.timezone
    });

    console.log(`⏰ Daily messages scheduled every minute ${String(hour).padStart(2, '0')}:00–${String(hour).padStart(2, '0')}:59 (${this.config.timezone})`);
    this.emit('scheduler:started');
  }

  /**
   * Остановить планировщик ежедневных раскладов
   */
  stopDailyScheduler(): void {
    if (!this.isRunning) {
      console.log('⚠️ Daily messaging scheduler is not running');
      return;
    }

    this.isRunning = false;

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    console.log('🛑 Daily messaging scheduler stopped');
    this.emit('scheduler:stopped');
  }

  /**
   * Обновить конфигурацию
   */
  async updateConfig(newConfig: Partial<DailyMessagingConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    console.log('⚙️ Daily messaging config updated:', {
      enabled: this.config.enabled,
      time: this.config.time,
      timezone: this.config.timezone
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

    try {
      await DailyMessagingConfigModel.updateOne({ key: 'default' }, {
        $set: {
          enabled: this.config.enabled,
          time: this.config.time,
          timezone: this.config.timezone,
          maxConcurrency: this.config.maxConcurrency,
          perMessageDelayMs: this.config.perMessageDelayMs,
          promptSystem: (this.config as any).promptSystem || '',
          promptUserTemplate: (this.config as any).promptUserTemplate || '',
          llmModel: (this.config as any).model || 'openai/gpt-4o-mini',
          temperature: (this.config as any).temperature ?? 0.7,
          sendFormat: (this.config as any).sendFormat || 'Markdown'
        }
      }, { upsert: true });
    } catch (error) {
      console.error('❌ Failed to persist DailyMessaging config:', error);
    }
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
    time: string;
    timezone: string;
    lastSentDate: string | null;
    nextRun: string | null;
  } {
    const nextRun = this.calculateNextRunISO();
    return {
      isRunning: this.isRunning,
      enabled: this.config.enabled,
      time: this.config.time,
      timezone: this.config.timezone,
      lastSentDate: this.lastSentDate,
      nextRun
    };
  }

  /**
   * Принудительно отправить расклады сейчас
   */
  async sendNow(): Promise<any> {
    console.log('🚀 Force sending daily messages now...');
    const startedAt = new Date();
    const res = await this.sendDailyMessagesToAll();
    const finishedAt = new Date();
    try {
      await DailyMessagingRunModel.create({
        startedAt,
        finishedAt,
        total: res.total,
        success: res.success,
        failed: res.failed,
        successRate: res.total > 0 ? res.success / res.total : 0,
        results: res.results,
        trigger: 'manual'
      });
    } catch (e) {
      console.error('❌ Failed to persist manual run:', e);
    }
    this.lastSentDate = new Date().toISOString();
    return res;
  }

  /**
   * Получить историю отправки сообщений
   */
  async getMessagingHistory(days: number = 7): Promise<any[]> {
    try {
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const items = await DailyMessagingRunModel.find({ startedAt: { $gte: from } })
        .sort({ startedAt: -1 })
        .limit(500)
        .lean();
      return items.map((i: any) => ({
        startedAt: i.startedAt,
        finishedAt: i.finishedAt,
        total: i.total,
        success: i.success,
        failed: i.failed,
        successRate: i.successRate,
        trigger: i.trigger
      }));
    } catch (error) {
      console.error('❌ Error getting messaging history:', error);
      throw error;
    }
  }

  private sanitizeGenerated(text: string, format: 'Markdown' | 'HTML' | string): string {
    if (!text) return '';
    let out = String(text);
    // Remove triple backticks fences
    out = out.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ''));
    out = out.replace(/```/g, '');
    // Remove markdown headings like ### Title
    out = out.replace(/^\s*#{1,6}\s*/gm, '');
    // Remove horizontal rules --- *** ___ lines
    out = out.replace(/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/gm, '');
    // Collapse excessive blank lines
    out = out.replace(/\n{3,}/g, '\n\n');
    // Trim trailing spaces
    out = out.replace(/[ \t]+$/gm, '');
    return out.trim();
  }

  private escapeHtml(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeMarkdown(s: string): string {
    return String(s).replace(/[*_`\[\]()>#+\-=|{}.!]/g, (ch) => `\\${ch}`);
  }

  private calculateNextRunISO(): string | null {
    try {
      const [hh, mm] = (this.config.time || '09:00').split(':').map((x) => Number(x));
      const now = new Date();
      // Build next run date in timezone by adjusting with Intl parts
      const formatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: this.config.timezone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(now);
      const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
      const year = Number(get('year'));
      const month = Number(get('month'));
      const day = Number(get('day'));

      const localTarget = new Date(Date.UTC(year, month - 1, day, hh, Number.isFinite(mm) ? mm : 0, 0));
      const candidate = localTarget;
      if (candidate.getTime() <= now.getTime()) {
        candidate.setUTCDate(candidate.getUTCDate() + 1);
      }
      return candidate.toISOString();
    } catch (e) {
      return null;
    }
  }

  private getDefaultSystemPrompt(): string {
    return `Ты опытный таролог, работающий с системой Таро Тота Алистера Кроули. Твоя задача - составить точную и полезную характеристику дня на основе 5 старших арканов.

ИНСТРУКЦИЯ:
- В начале ответа обязательно сделай приветствие с указанием даты рождения пользователя ({{birthday}}) и сегодняшней даты ({{today}}).
- Анализируй каждый аркан глубоко, учитывая его традиционные значения и специфику системы Кроули.
- Давай сбалансированную характеристику, показывая как позитивные, так и challenging аспекты.

СТРУКТУРА ОТВЕТА:

👋 ПРИВЕТСТВИЕ
   - Укажи дату рождения пользователя ({{birthday}}) и сегодняшнюю дату ({{today}}).

1. ЭНЕРГИЯ ДНЯ (на основе Аркана {{arcan0}})
   - 📈 Потенциал дня: какие возможности и благоприятные энергии несет этот аркан
   - ⚠️ Вызовы дня: какие сложности или предостережения связаны с этой энергией
   - 🔍 Ключевой фокус: на что особенно обратить внимание сегодня

2. ТЕМЫ И СОБЫТИЯ (на основе Аркана {{arcan1}})
   - 💫 Вероятные ситуации: какие события могут проявиться под влиянием этого аркана
   - 🎭 Позитивное развитие: как эти темы могут раскрыться благоприятно
   - 🌪️ Сложные аспекты: какие трудности могут возникнуть в этих сферах

3. ЭМОЦИОНАЛЬНОЕ СОСТОЯНИЕ (на основе синтеза Арканов {{arcan2}} и {{arcan3}})
   - ❤️ Доминирующие чувства: опиши эмоциональный фон от сочетания этих арканов
   - 🌈 Позитивные эмоции: какие светлые чувства могут проявиться
   - ☁️ Эмоциональные вызовы: с какими переживаниями может столкнуться человек
   - ⚖️ Баланс: как гармонизировать влияние двух арканов

4. СОВЕТ И СУТЬ ДНЯ (на основе Аркана {{arcan4}})
   - 🧭 Главный урок: основное послание дня
   - 💡 Практический совет: конкретные рекомендации для действий
   - 🌟 Духовный смысл: более глубокое понимание происходящего

ТОН И СТИЛЬ:
- Профессионально, но доступно
- Поддерживающий и вдохновляющий
- Конкретный, без излишней абстракции
- Баланс между эзотерической глубиной и практической применимостью

ФОРМАТИРОВАНИЕ:
Используй эмодзи для визуального разделения блоков, но не злоупрябляй ими.`;
  }

  private getDefaultUserTemplate(): string {
    return `Проанализируй расклад дня по следующим арканам Кроули:

🎴 Аркан 1 (Энергия дня): {{arcan0}}
🎴 Аркан 2 (Темы дня): {{arcan1}}
🎴 Аркан 3 (Эмоции, часть 1): {{arcan2}}
🎴 Аркан 4 (Эмоции, часть 2): {{arcan3}}
🎴 Аркан 5 (Совет дня): {{arcan4}}

Составь целостную характеристику дня.`;
  }
}

export const dailyMessagingService = new DailyMessagingService();
export default dailyMessagingService;
