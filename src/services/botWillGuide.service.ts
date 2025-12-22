import { Telegraf } from "telegraf";
import { EventEmitter } from "events";

import { BotInstance } from "../interfaces/bot";

import Customer from "../models/customer.model";
import AISettings from "../models/aiSettings.model";
import { IMessage } from "../models/messages.model";

class BotWillGuide extends EventEmitter {
  private bots: Map<string, BotInstance> = new Map();

  constructor() {
    super();
    console.log('🤖 BotWillGuide initialized');
  }

  async initialize() {
    console.log('🔄 Initializing BotWillGuide...');

    try {
      await this.loadAllBots();

      console.log(`✅ BotWillGuide initialized with ${this.bots.size} bots`);
      console.log('📡 Using Mongoose middleware for change detection (no replica set required)');
      this.emit('manager:initialized', { botsCount: this.bots.size });
    } catch (error) {
      console.error('❌ Error initializing BotWillGuide:', error);
      this.emit('manager:error', { error });
    }
  }

  private async loadAllBots() {
    console.log('🔍 Loading all customers from database...');

    const customers = await Customer.find({}, 'username willGuideToken _id subscriptionStatus subscriptionEndsAt');
    console.log(`📊 Found ${customers.length} customers in database`);

    if (customers.length === 0) {
      console.log('⚠️ No customers found in database');
      return;
    }

    const botPromises = customers.map(async (customer) => {
      console.log(`👤 Processing customer: ${customer.username}, has token: ${!!customer.botToken}`);

      const isSubscriptionActive = customer.subscriptionStatus === 'active' && customer.subscriptionEndsAt && customer.subscriptionEndsAt > new Date();

      if (customer.botToken && isSubscriptionActive) {
        try {
          console.log(`✅ Subscription active for ${customer.username}. Adding bot.`);
          await this.addBot((customer._id as any).toString(), customer.username, customer.willGuideToken!);
        } catch (error) {
          console.error(`❌ Failed to process customer ${customer.username}:`, error);
        }
      } else {
        console.log(`🚫 Customer ${customer.username} has no bot token or an inactive subscription.`);
      }
    });

    await Promise.allSettled(botPromises);

    console.log(`🎯 Loaded ${this.bots.size} bots out of ${customers.length} customers`);
  }

  private async startBotListening(botInstance: BotInstance) {
    if (botInstance.isListening) {
      console.log(`⚡ Bot for ${botInstance.username} is already listening`);
      return;
    }

    try {
      console.log(`📡 Launching bot polling for ${botInstance.username}...`);

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

  private async addBot(customerId: string, username: string, token: string): Promise<boolean> {
    if (this.bots.has(customerId)) {
      console.log(`🔄 Updating existing bot for customer: ${username}`);
      return await this.updateBot(customerId, username, token);
    }

    try {
      console.log(`🔧 Creating Telegraf instance for ${username} with token: ${token.substring(0, 10)}...`);
      const bot = new Telegraf(token);

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

      this.bots.set(customerId, botInstance);
      console.log(`💾 Bot instance saved to cache for ${username}`);

      console.log(`🚀 Starting bot listening for ${username}...`);
      this.startBotListening(botInstance);

      console.log(`✅ Bot added for customer: ${username} (@${botInfo.username})`);
      this.emit('bot:added', { customerId, username, botUsername: botInfo.username });

      return true;
    } catch (error) {
      console.error(`❌ Failed to add bot for customer ${username}:`, error);

      const botInstance: BotInstance = {
        bot: new Telegraf(token),
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

  private async updateBot(customerId: string, username: string, newToken: string): Promise<boolean> {
    const existingBot = this.bots.get(customerId);

    if (!existingBot) {
      return await this.addBot(customerId, username, newToken);
    }

    if (existingBot.token === newToken) {
      console.log(`⚡ Token unchanged for customer: ${username}`);
      return true;
    }

    try {
      await this.stopBotListening(existingBot);

      const newBot = new Telegraf(newToken);
      const botInfo = await newBot.telegram.getMe();

      existingBot.bot = newBot;
      existingBot.token = newToken;
      existingBot.username = username;
      existingBot.status = 'active';
      existingBot.lastUpdated = new Date();
      existingBot.isListening = false;

      this.startBotListening(existingBot);

      console.log(`🔄 Bot updated for customer: ${username} (@${botInfo.username})`);
      this.emit('bot:updated', { customerId, username, botUsername: botInfo.username });

      return true;
    } catch (error) {
      console.error(`❌ Failed to update bot for customer ${username}:`, error);

      existingBot.status = 'error';
      existingBot.lastUpdated = new Date();

      this.emit('bot:error', { customerId, username, error });
      return false;
    }
  }

  private async removeBot(customerId: string) {
    const botInstance = this.bots.get(customerId);
    if (botInstance) {
      await this.stopBotListening(botInstance);

      this.bots.delete(customerId);
      console.log(`🗑️ Bot removed for customer: ${botInstance.username}`);
      this.emit('bot:removed', { customerId, username: botInstance.username });
    }
  }

  getBot(customerId: string): Telegraf | null {
    const botInstance = this.bots.get(customerId);
    return botInstance?.status === 'active' ? botInstance.bot : null;
  }

  getBotInfo(customerId: string): BotInstance | null {
    return this.bots.get(customerId) || null;
  }

  getAllBots(): Map<string, BotInstance> {
    return new Map(this.bots);
  }

  getStats() {
    const stats = {
      total: this.bots.size,
      active: 0,
      inactive: 0,
      error: 0,
      listening: 0,
      isWatching: false,
      method: 'mongoose-middleware'
    };

    for (const bot of this.bots.values()) {
      stats[bot.status]++;
      if (bot.isListening) stats.listening++;
    }

    return stats;
  }

  async syncWithDatabase() {
    console.log('🔄 Syncing BotManager with database...');

    try {
      const customers = await Customer.find({}, 'username willGuideToken _id updatedAt');
      const currentBots = new Set(this.bots.keys());
      const dbCustomers = new Set<string>();

      for (const customer of customers) {
        const customerId = (customer._id as any).toString();
        dbCustomers.add(customerId);

        const existingBot = this.bots.get(customerId);

        if (!existingBot) {
          if (customer.willGuideToken) {
            await this.addBot(customerId, customer.username, customer.willGuideToken);
          }
        } else {
          if (customer.willGuideToken !== existingBot.token) {
            if (customer.willGuideToken) {
              await this.updateBot(customerId, customer.username, customer.willGuideToken);
            } else {
              await this.removeBot(customerId);
            }
          }
        }
      }

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

  async sendMessage(
    customerId: string,
    chatId: string,
    message: string,
    showWantButton: boolean = false,
    showCorrectButton: boolean = false,
    removeKeyboard: boolean = false,
    parse_mode: "HTML" | "Markdown" | "MarkdownV2" | undefined = undefined,
    customButtons?: string[],
    useInlineButtons: boolean = false
  ): Promise<{ success: boolean; error?: string; message?: IMessage; messageId?: number }> {
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
      } else if (customButtons && customButtons.length > 0) {
        if (useInlineButtons) {
          // Inline кнопки (компактный вид, прикрепленные к сообщению)
          const inlineKeyboard = customButtons.map(buttonText => {
            // Определяем короткий callback_data на основе текста кнопки
            let callbackData = 'horoscope_unknown';
            if (buttonText.includes('Деньги по Юпитеру')) callbackData = 'horoscope_jupiter';
            else if (buttonText.includes('Карма Изобилия')) callbackData = 'horoscope_venus';
            else if (buttonText.includes('Карма Мыслей')) callbackData = 'horoscope_mercury';
            else if (buttonText.includes('Уроки Сатурна')) callbackData = 'horoscope_saturn';
            else if (buttonText.includes('Прогноз на день')) callbackData = 'horoscope_daily';
            else if (buttonText.includes('Гороскоп на месяц')) callbackData = 'horoscope_monthly';
            else if (buttonText.includes('Периоды года')) callbackData = 'horoscope_periods';
            else if (buttonText.includes('Калькулятор Саде-сати')) callbackData = 'horoscope_sadesati';
            else if (buttonText.includes('Калькулятор карм экзамена')) callbackData = 'horoscope_karma';
            else if (buttonText.includes('Заполнить заново')) callbackData = 'horoscope_reset';
            // Продукты Таронумеролога
            else if (buttonText.includes('Тароскоп на любые месяцы')) callbackData = 'product_forecast';
            else if (buttonText.includes('Расчет 4 кода денег')) callbackData = 'product_financialcast';
            else if (buttonText.includes('Ошибки прошлого воплощения')) callbackData = 'product_mistakes';
            else if (buttonText.includes('Аркан самореализации')) callbackData = 'product_arcanum';
            else if (buttonText.includes('Три кода пробуждения')) callbackData = 'product_awakening';
            
            return [{
              text: buttonText,
              callback_data: callbackData
            }];
          });
          options.reply_markup = {
            inline_keyboard: inlineKeyboard
          };
        } else {
          // Обычная клавиатура
          const keyboard = customButtons.map(buttonText => [{ text: buttonText }]);
          options.reply_markup = {
            keyboard,
            resize_keyboard: true,
            one_time_keyboard: true,
          };
        }
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

      this.emit('message:sent', {
        customerId,
        chatId,
        messageLength: message.length,
        hasButton: showWantButton || showCorrectButton || (customButtons && customButtons.length > 0),
        hasWantButton: showWantButton,
        hasCorrectButton: showCorrectButton,
        hasCustomButtons: customButtons && customButtons.length > 0,
        customButtonsCount: customButtons ? customButtons.length : 0,
        removedKeyboard: removeKeyboard,
        useInlineButtons,
      });

      return { success: true, messageId: result.message_id };
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

  async editOrDeleteMessage(
    customerId: string,
    chatId: string,
    messageId: number,
    newText?: string,
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2"
  ): Promise<{ success: boolean; error?: string }> {
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
      if (newText) {
        // Редактируем сообщение
        await bot.telegram.editMessageText(chatId, messageId, undefined, newText, { parse_mode });
        console.log(`✏️ Message ${messageId} edited in chat ${chatId}`);
      } else {
        // Удаляем сообщение
        await bot.telegram.deleteMessage(chatId, messageId);
        console.log(`🗑️ Message ${messageId} deleted in chat ${chatId}`);
      }
      return { success: true };
    } catch (error: any) {
      console.error(`❌ Failed to edit/delete message ${messageId}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  async sendMessageWithPaymentButton(
    customerId: string,
    chatId: string,
    message: string,
    paymentUrl: string,
    parse_mode: "HTML" | "Markdown" | "MarkdownV2" | undefined = undefined,
    buttonText: string = 'Оплатить'
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
        reply_markup: {
          inline_keyboard: [[
            {
              text: buttonText,
              url: paymentUrl
            }
          ]]
        }
      };
      
      const result = await bot.telegram.sendMessage(chatId, message, options);

      this.emit('message:sent', {
        customerId,
        chatId,
        messageLength: message.length,
        hasPaymentButton: true,
      });

      return { success: true };
    } catch (error: any) {
      console.error(`❌ Failed to send message with payment button via bot for customer ${botInfo.username}:`, error);

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

  private async sendRequestToAI(
    data: any, 
    apiKey: string, 
    provider: 'vsegpt' | 'openai' = 'vsegpt',
    fetchAgent?: any
  ): Promise<any> {
    try {
      let url: string;
      
      if (provider === 'openai') {
        url = 'https://api.openai.com/v1/chat/completions';
      } else {
        url = 'https://api.vsegpt.ru/v1/chat/completions';
      }

      const fetchOptions: any = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(data)
      };

      // Добавляем прокси агент если он передан
      if (fetchAgent) {
        fetchOptions.agent = fetchAgent;
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error sending request to AI API:', error);
      throw error;
    }
  }

  private cleanAIResponse(text: string): string {
    if (!text) return '';
    
    let cleaned = text.trim();
    
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    cleaned = cleaned.replace(/[ \t]+$/gm, '');
    
    return cleaned;
  }

  async generateAIResponse(
    systemPrompt: string,
    userPrompts: string | string[],
    model: string = "openai/gpt-4o-mini",
    temperature: number = 0.7,
    provider: 'vsegpt' | 'openai' = 'vsegpt'
  ): Promise<string | null> {
    try {
      // Получаем глобальные настройки AI из БД
      let settings = await AISettings.findOne();
      
      // Если настроек нет, создаем дефолтные
      if (!settings) {
        settings = await AISettings.create({
          vsegptApiKey: process.env.VSE_GPT_API_KEY || ''
        });
      }

      let apiKey: string;

      if (provider === 'openai') {
        apiKey = settings.openaiApiKey || '';
        
        if (!apiKey) {
          throw new Error('OpenAI API key not configured');
        }
      } else {
        apiKey = settings.vsegptApiKey || process.env.VSE_GPT_API_KEY || '';
        
        if (!apiKey) {
          throw new Error('VseGPT API key not configured');
        }
      }

      const messages: Array<{ role: string; content: string }> = [
        {
          role: "system",
          content: systemPrompt
        }
      ];

      const userPromptsArray = Array.isArray(userPrompts) ? userPrompts : [userPrompts];
      
      for (const prompt of userPromptsArray) {
        messages.push({
          role: "user",
          content: prompt
        });
      }

      const requestData = {
        model,
        messages,
        temperature
      };

      console.log(`🤖 Sending AI request with ${messages.length} messages via ${provider}...`);
      
      const response = await this.sendRequestToAI(requestData, apiKey, provider);
      const aiMessage = response?.choices?.[0]?.message?.content;
      
      if (!aiMessage) {
        throw new Error('No content in AI response');
      }

      const cleanedResponse = this.cleanAIResponse(aiMessage);
      
      console.log(`✅ AI response received (${cleanedResponse.length} characters)`);
      
      return cleanedResponse;
      
    } catch (error) {
      console.error('❌ Error generating AI response:', error);
      return null;
    }
  }

  async stop() {
    console.log('🛑 Stopping BotManager...');

    for (const botInstance of this.bots.values()) {
      await this.stopBotListening(botInstance);
    }

    this.bots.clear();
    console.log('🛑 BotManager stopped');
    this.emit('manager:stopped');
  }

  async reload() {
    console.log('🔄 Reloading all bots...');

    for (const botInstance of this.bots.values()) {
      await this.stopBotListening(botInstance);
    }

    this.bots.clear();
    await this.loadAllBots();
    console.log(`✅ Reloaded ${this.bots.size} bots`);
    this.emit('manager:reloaded', { botsCount: this.bots.size });
  }
}

export const botWillGuide = new BotWillGuide();
export default botWillGuide;
