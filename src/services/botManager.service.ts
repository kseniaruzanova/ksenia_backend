import * as path from "path";
import * as fs from "fs";
import { Telegraf } from "telegraf";
import { EventEmitter } from "events";
import { Writable } from "stream";
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

import { degreesToSign } from "../lib/zodiac";
import { BotInstance } from "../interfaces/bot";

import { getMonthlyHoroscopeForZodiac, isInRange } from "../utils/horoscope";
import { getTimezoneFromLongitude } from "../utils/geocoding";
import { convertDateFormat, parseBirthDate } from "../utils/astro";
import { getMessageType, readSystemPromptFromFile } from "../utils/bot";
import { toArcana, splitNumberIntoDigits, getArcanFilePath } from "../utils/arcan";

import User from "../models/user.model";
import Customer from "../models/customer.model";
import AISettings from "../models/aiSettings.model";
import { Chat, IChat } from "../models/chat.model";
import { EphemerisConfig } from "../models/chart.model";
import { IMessage, Message, MessageType } from "../models/messages.model";

import { AstroProcessor } from "./astroProcessor.service";
import dailyMessagingService from "./dailyMessaging.service";
import { 
  generateForecastPdf, 
  generateFinancialCastPdf, 
  generateMistakesIncarnationPdf, 
  generateAwakeningCodesPdf 
} from "./pdfGenerator.service";

import monthlyHoroscope from "../data/natal/monthly.json";
import monthsData from "../data/taroscop/months.json";
import yearDoorData from "../data/taroscop/yearDoor.json";
import riskData from "../data/taroscop/risk.json";
import eventsData from "../data/taroscop/events.json";
import archetypePovertyData from "../data/financialCast/archetypePoverty.json";
import dutyData from "../data/financialCast/duty.json";
import knotData from "../data/financialCast/knot.json";
import shadowBData from "../data/financialCast/shadowB.json";
import ritualsData from "../data/financialCast/rituals.json";
import karmicLessonsData from "../data/mistakesIncarnation/karmicLessons.json";
import lessonIncarnationData from "../data/mistakesIncarnation/lessonIncarnation.json";
import coreData from "../data/awakeningCodes/core.json";
import fearData from "../data/awakeningCodes/fear.json";
import implementationData from "../data/awakeningCodes/implementation.json";

class BotManager extends EventEmitter {
  private bots: Map<string, BotInstance> = new Map();
  private astroProcessor: AstroProcessor;

  constructor() {
    super();
    console.log('🤖 BotManager initialized');
    this.startSubscriptionChecker();
    
    const config: EphemerisConfig = { ephemerisPath: '', flags: 0 };
    this.astroProcessor = new AstroProcessor(config, 'EQUAL');
    this.initializeAstroProcessor();
  }

  private async initializeAstroProcessor() {
    try {
      await this.astroProcessor.initialize();
      console.log('✨ AstroProcessor initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AstroProcessor:', error);
    }
  }

  async initialize() {
    console.log('🔄 Initializing BotManager...');

    try {
      await this.loadAllBots();

      console.log(`✅ BotManager initialized with ${this.bots.size} bots`);
      console.log('📡 Using Mongoose middleware for change detection (no replica set required)');
      this.emit('manager:initialized', { botsCount: this.bots.size });
    } catch (error) {
      console.error('❌ Error initializing BotManager:', error);
      this.emit('manager:error', { error });
    }
  }

  private async loadAllBots() {
    console.log('🔍 Loading all customers from database...');

    const customers = await Customer.find({}, 'username botToken _id subscriptionStatus subscriptionEndsAt');
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
          await this.addBot((customer._id as any).toString(), customer.username, customer.botToken);
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

  private async handleIncomingMessage(customerId: string, ctx: any) {
    const chatId = ctx.chat.id.toString();
    const userId = ctx.from.id.toString();
    const messageType = getMessageType(ctx.message);

    try {
      const chat = await this.saveChat(customerId, chatId, userId, ctx.from);

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

  private startSubscriptionChecker() {
    setInterval(async () => {
      console.log('⏰ Checking for expired subscriptions...');
      const customers = await Customer.find({ 
        subscriptionStatus: 'active',
        subscriptionEndsAt: { $lt: new Date() } 
      });

      for (const customer of customers) {
        console.log(`⌛ Subscription expired for ${customer.username}. Deactivating...`);
        customer.subscriptionStatus = 'inactive';
        
        await customer.save();
      }
    }, 3600 * 1000);
  }

  private async searchCityData(cityQuery: string): Promise<any> {
    try {
      const searchResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(cityQuery)}&` +
        `format=json&` +
        `addressdetails=1&` +
        `limit=1&` +
        `countrycodes=by,ru,us,gb,de,fr,it,es,ca,au,jp,cn,kr,sg,th,ae,in,nz,eg,za,ng,br,ar,pe,cl,mx&` +
        `featuretype=city,town,village`,
        {
          headers: {
            'User-Agent': 'AstroApp/1.0'
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Nominatim API error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json() as any[];
      
      if (searchData.length === 0) {
        return null;
      }

      const city = searchData[0];
      const latitude = parseFloat(city.lat);
      const longitude = parseFloat(city.lon);

      let timezoneData = null;
      try {
        const apiKey = process.env.TIMEZONEDB_API_KEY || 'demo';
        const timezoneResponse = await fetch(
          `http://api.timezonedb.com/v2.1/get-time-zone?` +
          `key=${apiKey}&` +
          `format=json&` +
          `by=position&` +
          `lat=${latitude}&` +
          `lng=${longitude}`,
          {
            headers: {
              'User-Agent': 'AstroApp/1.0'
            }
          }
        );
        
        if (timezoneResponse.ok) {
          const timezoneResult = await timezoneResponse.json() as any;
          if (timezoneResult.status === 'OK') {
            timezoneData = {
              utcOffset: timezoneResult.gmtOffset / 3600,
              timezoneId: timezoneResult.zoneName,
              timezoneName: timezoneResult.abbreviation,
              countryCode: timezoneResult.countryCode,
              countryName: timezoneResult.countryName
            };
          }
        }
      } catch (timezoneError) {
        console.warn('Failed to get timezone, using fallback:', timezoneError);
      }

      if (!timezoneData) {
        const fallbackTimezone = getTimezoneFromLongitude(longitude);
        timezoneData = {
          utcOffset: fallbackTimezone,
          timezoneId: 'Unknown',
          timezoneName: `UTC${fallbackTimezone >= 0 ? '+' : ''}${fallbackTimezone}`,
          countryCode: 'Unknown',
          countryName: 'Unknown'
        };
      }

      return {
        place_id: city.place_id,
        display_name: city.display_name,
        lat: latitude,
        lon: longitude,
        type: city.type,
        importance: city.importance,
        timezone: timezoneData
      };
    } catch (error) {
      console.error('Error searching city data:', error);
      return null;
    }
  }

  private async calculatePlanetPosition(user: any, planetName: string): Promise<any> {
    try {
      const convertedBirthday = user.birthday.includes('.') 
        ? convertDateFormat(user.birthday) 
        : user.birthday;
      
      const formattedBirthTime = user.birthTime && user.birthTime.includes(':') 
        ? user.birthTime 
        : '10:00';
      
      const dateStr = `${convertedBirthday}T${formattedBirthTime}`;
      const birthDateUTC = parseBirthDate(dateStr, user.timezone || 0);

      const chart = await this.astroProcessor.calculateNatalChart(
        birthDateUTC,
        user.latitude,
        user.longitude,
        user.timezone || 0
      );

      const planetData = chart.planets.find((p: any) => 
        p.name.toLowerCase() === planetName.toLowerCase()
      );

      if (!planetData) {
        throw new Error(`Planet ${planetName} not found`);
      }

      const zodiacSign = degreesToSign(planetData.longitude);
      
      const signNumbers = {
        'Aries': 1, 'Taurus': 2, 'Gemini': 3, 'Cancer': 4,
        'Leo': 5, 'Virgo': 6, 'Libra': 7, 'Scorpio': 8,
        'Sagittarius': 9, 'Capricorn': 10, 'Aquarius': 11, 'Pisces': 12
      };

      const signNumber = signNumbers[zodiacSign.sign as keyof typeof signNumbers] || 0;

      return {
        planet: planetData.name,
        longitude: planetData.longitude,
        zodiacSign: {
          number: signNumber,
          name: zodiacSign.sign,
          degree: zodiacSign.degree,
          minute: zodiacSign.minute,
          second: zodiacSign.second
        }
      };
    } catch (error) {
      console.error(`Error calculating planet position for ${planetName}:`, error);
      throw error;
    }
  }

  private getHoroscopeFilePath(planetName: string, signNumber: number): string {
    const planetFolder = planetName.toLowerCase();
    const fileName = `${signNumber}.pdf`;
    return path.join(process.cwd(), 'src', 'data', 'natal', planetFolder, fileName);
  }

  private async sendHoroscopeFile(customerId: string, chatId: string, planetName: string, user: any): Promise<void> {
    try {
      const planetData = await this.calculatePlanetPosition(user, planetName);
      const signNumber = planetData.zodiacSign.number;
      
      const filePath = this.getHoroscopeFilePath(planetName, signNumber);
      
      const russianSignNames = {
        1: 'Овен', 2: 'Телец', 3: 'Близнецы', 4: 'Рак',
        5: 'Лев', 6: 'Дева', 7: 'Весы', 8: 'Скорпион',
        9: 'Стрелец', 10: 'Козерог', 11: 'Водолей', 12: 'Рыбы'
      };

      const russianName = russianSignNames[signNumber as keyof typeof russianSignNames] || 'неизвестно';
      
      const planetNames = {
        'jupiter': 'Юпитер',
        'venus': 'Венера', 
        'mercury': 'Меркурий',
        'saturn': 'Сатурн'
      };

      const planetRussianName = planetNames[planetName.toLowerCase() as keyof typeof planetNames] || planetName;

      const caption = 
        `🔮 *${planetRussianName} в знаке ${russianName}*\n\n` +
        `📍 Позиция: ${planetData.zodiacSign.degree}°${planetData.zodiacSign.minute}'${planetData.zodiacSign.second}" ${russianName}\n\n` +
        `✨ Ваш персональный гороскоп готов!`;

      await this.sendFile(
        customerId,
        chatId,
        filePath,
        caption,
        false,
        false,
        false,
        "Markdown"
      );

      setTimeout(async () => {
        const nextHoroscopeMessage = 
          "✨ *Хотите получить еще один гороскоп?*\n\n" +
          "Выберите один из доступных вариантов:";

        await this.sendMessage(
          customerId,
          chatId,
          nextHoroscopeMessage,
          false,
          false,
          false,
          "Markdown",
          [
            "💰 Деньги по Юпитеру",
            "💫 Карма Изобилия",
            "🧠 Карма Мыслей",
            "🧐 Уроки Сатурна",
            "📅 Прогноз на день",
            "📆 Гороскоп на месяц",
            "🌸 Периоды года",
            "🔮 Калькулятор Саде-сати",
            "⚡ Калькулятор карм экзамена",
            "✍️ Заполнить заново"
          ],
          true
        );
      }, 1000);

    } catch (error) {
      console.error(`Error sending horoscope file for ${planetName}:`, error);
      
      await this.sendMessage(
        customerId,
        chatId,
        `❌ Произошла ошибка при генерации гороскопа. Попробуйте еще раз или обратитесь к администратору.`,
        false,
        false,
        false,
        undefined
      );
    }
  }

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

  private setupBotHandlers(bot: Telegraf, customerId: string, username: string) {
    bot.start(async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      console.log(`👋 /start command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        await this.sendMessage(
          customerId,
          chatId,
          `Введи свою дату рождения в формате ДД.ММ.ГГГГ — и я заговорю. Не расскажу, а покажу — кем ты стал, кем боишься быть и кем пришёл стать.  Твоя личность — это код. Я прочту его. И ты больше не останешься прежним.`,
          false,
          false,
          false,
          undefined,
        )

        const existingUser = await User.findOne({ chat_id: chatId, customerId: customerId });

        if (!existingUser) {
          await User.create({
            chat_id: chatId,
            customerId: customerId,
            state: 'step_1',
            createdAt: new Date()
          });
        } else {
          await User.updateOne(
            { chat_id: chatId, customerId: customerId },
            { $set: { state: 'step_1' } }
          );
        }

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'command',
          command: 'start',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling /start for customer ${username}:`, error);
      }
    });

    bot.command('new_chat', async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      console.log(`🔄 /new_chat command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        const existingUser = await User.findOne({ chat_id: chatId, customerId: customerId });

        if (!existingUser) {
          await User.create({
            chat_id: chatId,
            customerId: customerId,
            state: 'step_1',
            createdAt: new Date()
          });
        } else {
          await User.updateOne(
            { chat_id: chatId, customerId: customerId },
            { $set: { state: 'step_1' } }
          );
        }

        await this.sendMessage(
          customerId,
          chatId,
          `Начинаем сначала! Введи свою дату рождения в формате ДД.ММ.ГГГГ — и я заговорю. Не расскажу, а покажу — кем ты стал, кем боишься быть и кем пришёл стать.  Твоя личность — это код. Я прочту его. И ты больше не останешься прежним.`,
          false,
          false,
          false,
          undefined,
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'command',
          command: 'new_chat',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling /new_chat for customer ${username}:`, error);
      }
    });

    bot.command('astrolog', async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      console.log(`🔮 /astrolog command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);
      
      try {
        const user = await User.findOne({ chat_id: chatId, customerId: customerId });

        const hasAllData = user && 
          user.birthday && 
          user.birthTime && 
          user.latitude !== undefined && 
          user.longitude !== undefined && 
          user.timezone !== undefined && 
          user.city_name;

        if (!hasAllData) {
          const message = "Звезды хранят карту вашей судьбы, и я могу ее прочесть. Чтобы узнать, что они приготовили именно для вас, укажите дату вашего рождения (ДД.ММ.ГГГГ)";

          await this.sendMessage(
            customerId,
            chatId,
            message,
            false,
            false,
            false,
            "Markdown"
          );

          const existingUser = await User.findOne({ chat_id: chatId, customerId: customerId });
          
          if (!existingUser) {
            await User.create({
              chat_id: chatId,
              customerId: customerId,
              state: 'natal_1',
              createdAt: new Date()
            });
          } else {
            await User.updateOne(
              { chat_id: chatId, customerId: customerId },
              { $set: { state: 'natal_1' } }
            );
          }
        } else {
          const message = 
            "✨ Отлично! Я сохранила твои данные для точных расчётов:\n\n" +
            `📅 *Дата рождения:* ${user?.birthday}\n` +
            `⏰ *Время рождения:* ${user?.birthTime}\n` +
            `🏙️ *Город рождения:* ${user?.city_name}\n\n` +
            "Если всё верно — выбирай гороскоп! Если хочешь исправить данные — нажми «Заполнить заново».";

          await this.sendMessage(
            customerId,
            chatId,
            message,
            false,
            false,
            false,
            "Markdown",
            [
              "💰 Деньги по Юпитеру",
              "💫 Карма Изобилия",
              "🧠 Карма Мыслей",
              "🧐 Уроки Сатурна",
              "📅 Прогноз на день",
              "📆 Гороскоп на месяц",
              "🌸 Периоды года",
              "🔮 Калькулятор Саде-сати",
              "⚡ Калькулятор карм экзамена",
              "✍️ Заполнить заново"
            ],
            true
          );

          console.log(`✅ Sent astrological data for user ${chatId}`);

          await User.findOneAndUpdate(
            { chat_id: chatId, customerId: customerId },
            { state: 'natal_5' }
          );
        }

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'command',
          command: 'astrolog',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling /astrolog for customer ${username}:`, error);
      }
    });

    bot.command('menu', async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      console.log(`🔄 /menu command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        const menuText = "🔮 *Главное меню*\n\nВыберите, что вас интересует:";
        
        const options: any = {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌟 Астролог', callback_data: 'menu_astrolog' }],
              [{ text: '🔮 Гадалка', callback_data: 'menu_fortune' }],
              [{ text: '💬 Диалог с пророком', callback_data: 'menu_dialog' }],
              [{ text: '🃏 Таронумеролог', callback_data: 'menu_tarot' }],
              [{ text: '📖 Инструкции', callback_data: 'menu_instructions' }],
              [{ text: '💎 Подписка', callback_data: 'menu_subscription' }]
            ]
          }
        };
        
        const result = await bot.telegram.sendMessage(chatId, menuText, options);

        const chat = await Chat.findOne({ customerId, chatId });
        if (chat) {
          const savedMessage = await this.saveMessage({
            chat,
            customerId,
            messageId: result.message_id.toString(),
            type: 'text',
            direction: 'out',
            content: { text: menuText }
          }); 
        }

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'command',
          command: 'menu',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling /menu for customer ${username}:`, error);
      }
    });

    bot.command('gadalka', async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      console.log(`🔮 /gadalka command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        await this.sendMessage(
          customerId,
          chatId,
          "🔮 *Гадалка*\n\nДанная функция находится в разработке и скоро будет доступна!",
          false,
          false,
          false,
          "Markdown"
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'command',
          command: 'gadalka',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling /gadalka for customer ${username}:`, error);
      }
    });

    bot.command('dialog', async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      console.log(`💬 /dialog command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        const existingUser = await User.findOne({ chat_id: chatId, customerId: customerId });

        if (!existingUser) {
          await User.create({
            chat_id: chatId,
            customerId: customerId,
            state: 'step_1',
            createdAt: new Date()
          });
        } else {
          await User.updateOne(
            { chat_id: chatId, customerId: customerId },
            { $set: { state: 'step_1' } }
          );
        }

        await this.sendMessage(
          customerId,
          chatId,
          `Начинаем сначала! Введи свою дату рождения в формате ДД.ММ.ГГГГ — и я заговорю. Не расскажу, а покажу — кем ты стал, кем боишься быть и кем пришёл стать.  Твоя личность — это код. Я прочту его. И ты больше не останешься прежним.`,
          false,
          false,
          false,
          undefined,
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'command',
          command: 'dialog',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling /dialog for customer ${username}:`, error);
      }
    });

    bot.command('matrica', async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      console.log(`🃏 /matrica command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        await this.sendMessage(
          customerId,
          chatId,
          "🃏 *Таронумеролог*\n\nДанная функция находится в разработке и скоро будет доступна!",
          false,
          false,
          false,
          "Markdown"
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'command',
          command: 'matrica',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling /matrica for customer ${username}:`, error);
      }
    });

    bot.command('instruction', async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      console.log(`📖 /instruction command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        const instructions = 
          "📖 *Инструкция по использованию бота*\n\n" +
          "🌟 *Астролог* — Получите персональный астрологический прогноз. Я рассчитаю вашу натальную карту и расскажу о:\n" +
          "  • Деньгах по Юпитеру\n" +
          "  • Карме Изобилия (Венера)\n" +
          "  • Карме Мыслей (Меркурий)\n" +
          "  • Уроках Сатурна\n\n" +
          "💬 *Диалог с пророком* — Начните беседу с самого начала. Я помогу вам разобраться в себе через глубокий диалог и астрологический анализ.\n\n" +
          "🔮 *Гадалка* — Магические предсказания и гадания (в разработке)\n\n" +
          "🃏 *Таронумеролог* — Расклады Таро и нумерологический анализ (в разработке)\n\n" +
          "💎 *Подписка* — Оформите месячную подписку для доступа ко всем функциям бота\n\n" +
          "📝 *Доступные команды:*\n" +
          "`/menu` — Главное меню\n" +
          "`/astrolog` — Астрологический прогноз\n" +
          "`/dialog` — Начать новый диалог\n" +
          "`/gadalka` — Гадалка\n" +
          "`/matrica` — Таронумеролог\n" +
          "`/instruction` — Полезные инструкции\n" +
          "`/podpiska` — Оформить подписку\n\n" +
          "Выберите нужный раздел в меню, и я помогу вам раскрыть тайны вашей судьбы! ✨";

        await this.sendMessage(
          customerId,
          chatId,
          instructions,
          false,
          false,
          false,
          "Markdown"
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'command',
          command: 'instruction',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling /instruction for customer ${username}:`, error);
      }
    });

    bot.command('podpiska', async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId = ctx.chat.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      console.log(`💎 /podpiska command from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        await this.sendMessage(
          customerId,
          chatId,
          "💎 *Подписка*\n\nДанная функция находится в разработке и скоро будет доступна!",
          false,
          false,
          false,
          "Markdown"
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'command',
          command: 'podpiska',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling /podpiska for customer ${username}:`, error);
      }
    });

    // Обработчики callback кнопок меню
    bot.action('menu_astrolog', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      if (!chatId) return;

      console.log(`🌟 Menu: Астролог from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        await ctx.answerCbQuery();

        const user = await User.findOne({ chat_id: chatId, customerId: customerId });

        const hasAllData = user && 
          user.birthday && 
          user.birthTime && 
          user.latitude !== undefined && 
          user.longitude !== undefined && 
          user.timezone !== undefined && 
          user.city_name;

        if (!hasAllData) {
          const message = "Звезды хранят карту вашей судьбы, и я могу ее прочесть. Чтобы узнать, что они приготовили именно для вас, укажите дату вашего рождения (ДД.ММ.ГГГГ)";

          await this.sendMessage(
            customerId,
            chatId,
            message,
            false,
            false,
            false,
            "Markdown"
          );

          await User.findOneAndUpdate(
            { chat_id: chatId, customerId: customerId },
            {
              $set: {
                chat_id: chatId,
                customerId: customerId
              },
              $setOnInsert: {
                state: 'natal_1',
                createdAt: new Date()
              }
            },
            { upsert: true, new: true }
          );
        } else {
          const message = 
            "✨ Отлично! Я сохранила твои данные для точных расчётов:\n\n" +
            `📅 *Дата рождения:* ${user?.birthday}\n` +
            `⏰ *Время рождения:* ${user?.birthTime}\n` +
            `🏙️ *Город рождения:* ${user?.city_name}\n\n` +
            "Если всё верно — выбирай гороскоп! Если хочешь исправить данные — нажми «Заполнить заново».";

          await this.sendMessage(
            customerId,
            chatId,
            message,
            false,
            false,
            false,
            "Markdown",
            [
              "💰 Деньги по Юпитеру",
              "💫 Карма Изобилия",
              "🧠 Карма Мыслей",
              "🧐 Уроки Сатурна",
              "📅 Прогноз на день",
              "📆 Гороскоп на месяц",
              "🌸 Периоды года",
              "🔮 Калькулятор Саде-сати",
              "⚡ Калькулятор карм экзамена",
              "✍️ Заполнить заново"
            ],
            true
          );

          console.log(`✅ Sent astrological data for user ${chatId}`);

          await User.findOneAndUpdate(
            { chat_id: chatId, customerId: customerId },
            { state: 'natal_5' }
          );
        }

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'callback',
          command: 'menu_astrolog',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling menu_astrolog for customer ${username}:`, error);
      }
    });

    bot.action('menu_fortune', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      if (!chatId) return;

      console.log(`🔮 Menu: Гадалка from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        await ctx.answerCbQuery();

        await this.sendMessage(
          customerId,
          chatId,
          "🔮 *Гадалка*\n\nДанная функция находится в разработке и скоро будет доступна!",
          false,
          false,
          false,
          "Markdown"
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'callback',
          command: 'menu_fortune',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling menu_fortune for customer ${username}:`, error);
      }
    });

    bot.action('menu_dialog', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      if (!chatId) return;

      console.log(`💬 Menu: Диалог с пророком from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        await ctx.answerCbQuery();

        const existingUser = await User.findOne({ chat_id: chatId, customerId: customerId });

        if (!existingUser) {
          await User.create({
            chat_id: chatId,
            customerId: customerId,
            state: 'step_1',
            createdAt: new Date()
          });
        } else {
          await User.updateOne(
            { chat_id: chatId, customerId: customerId },
            { $set: { state: 'step_1' } }
          );
        }

        await this.sendMessage(
          customerId,
          chatId,
          `Начинаем сначала! Введи свою дату рождения в формате ДД.ММ.ГГГГ — и я заговорю. Не расскажу, а покажу — кем ты стал, кем боишься быть и кем пришёл стать.  Твоя личность — это код. Я прочту его. И ты больше не останешься прежним.`,
          false,
          false,
          false,
          undefined,
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'callback',
          command: 'menu_dialog',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling menu_dialog for customer ${username}:`, error);
      }
    });

    bot.action('menu_tarot', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      if (!chatId) return;

      console.log(`🃏 Menu: Таронумеролог from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        await ctx.answerCbQuery();

        await this.sendMessage(
          customerId,
          chatId,
          "🃏 *Таронумеролог*\n\nВыберите нужный расчет для генерации персонального результата:",
          false,
          false,
          false,
          "Markdown",
          [
            "🔮 Тароскоп на любые месяцы",
            "💰 Расчет 4 кода денег",
            "🕰️ Ошибки прошлого воплощения",
            "✨ Аркан самореализации",
            "✨ Три кода пробуждения"
          ],
          true
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'callback',
          command: 'menu_tarot',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling menu_tarot for customer ${username}:`, error);
      }
    });

    bot.action('menu_instructions', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      if (!chatId) return;

      console.log(`📖 Menu: Инструкции from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        await ctx.answerCbQuery();

        const instructions = 
          "📖 *Инструкция по использованию бота*\n\n" +
          "🌟 *Астролог* — Получите персональный астрологический прогноз. Я рассчитаю вашу натальную карту и расскажу о:\n" +
          "  • Деньгах по Юпитеру\n" +
          "  • Карме Изобилия (Венера)\n" +
          "  • Карме Мыслей (Меркурий)\n" +
          "  • Уроках Сатурна\n\n" +
          "💬 *Диалог с пророком* — Начните беседу с самого начала. Я помогу вам разобраться в себе через глубокий диалог и астрологический анализ.\n\n" +
          "🔮 *Гадалка* — Магические предсказания и гадания (в разработке)\n\n" +
          "🃏 *Таронумеролог* — Расклады Таро и нумерологический анализ (в разработке)\n\n" +
          "💎 *Подписка* — Оформите месячную подписку для доступа ко всем функциям бота\n\n" +
          "📝 *Доступные команды:*\n" +
          "`/menu` — Главное меню\n" +
          "`/astrolog` — Астрологический прогноз\n" +
          "`/dialog` — Начать новый диалог\n" +
          "`/gadalka` — Гадалка\n" +
          "`/matrica` — Таронумеролог\n" +
          "`/instruction` — Полезные инструкции\n" +
          "`/podpiska` — Оформить подписку\n\n" +
          "Выберите нужный раздел в меню, и я помогу вам раскрыть тайны вашей судьбы! ✨";

        await this.sendMessage(
          customerId,
          chatId,
          instructions,
          false,
          false,
          false,
          "Markdown"
        );

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'callback',
          command: 'menu_instructions',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling menu_instructions for customer ${username}:`, error);
      }
    });

    bot.action('menu_subscription', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      if (!chatId) return;

      console.log(`💎 Menu: Подписка from ${firstName} ${lastName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {

        await this.sendMessage(
          customerId,
          chatId,
          "💎 *Подписка*\n\nДанная функция находится в разработке и скоро будет доступна!",
          false,
          false,
          false,
          "Markdown"
        );
        
        this.emit('message:received', {
          customerId,
          chatId,
          type: 'callback',
          command: 'menu_subscription',
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling menu_subscription for customer ${username}:`, error);
      }
    });

    // ========== Обработчики продуктов Таронумеролога ==========
    
    // Тароскоп на любые месяцы
    bot.action('product_forecast', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;

      try {
        await ctx.answerCbQuery();
        await this.handleProductRequest(customerId, chatId, 'forecast', '🔮 Тароскоп на любые месяцы');
      } catch (error) {
        console.error(`❌ Error handling product_forecast for customer ${username}:`, error);
      }
    });

    // Расчет 4 кода денег
    bot.action('product_financialcast', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;

      try {
        await ctx.answerCbQuery();
        await this.handleProductRequest(customerId, chatId, 'financialCast', '💰 Расчет 4 кода денег');
      } catch (error) {
        console.error(`❌ Error handling product_financialcast for customer ${username}:`, error);
      }
    });

    // Ошибки прошлого воплощения
    bot.action('product_mistakes', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;

      try {
        await ctx.answerCbQuery();
        await this.handleProductRequest(customerId, chatId, 'mistakesIncarnation', '🕰️ Ошибки прошлого воплощения');
      } catch (error) {
        console.error(`❌ Error handling product_mistakes for customer ${username}:`, error);
      }
    });

    // Аркан самореализации
    bot.action('product_arcanum', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;

      try {
        await ctx.answerCbQuery();
        await this.handleProductRequest(customerId, chatId, 'arcanumRealization', '✨ Аркан самореализации');
      } catch (error) {
        console.error(`❌ Error handling product_arcanum for customer ${username}:`, error);
      }
    });

    // Три кода пробуждения
    bot.action('product_awakening', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;

      try {
        await ctx.answerCbQuery();
        await this.handleProductRequest(customerId, chatId, 'awakeningCodes', '✨ Три кода пробуждения');
      } catch (error) {
        console.error(`❌ Error handling product_awakening for customer ${username}:`, error);
      }
    });

    // Обработчик кнопки "Получить бесплатный гороскоп"
    bot.action('get_free_horoscope', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;

      try {
        await ctx.answerCbQuery();
        await ctx.editMessageText(
          "🌟 Отлично! Переходим к астрологу...",
          { parse_mode: 'Markdown' }
        );

        // Перенаправляем в астролога
        const user = await User.findOne({ chat_id: chatId, customerId: customerId });
        const hasAllData = user && 
          user.birthday && 
          user.birthTime && 
          user.latitude !== undefined && 
          user.longitude !== undefined && 
          user.timezone !== undefined && 
          user.city_name;

        if (!hasAllData) {
          const existingUser = await User.findOne({ chat_id: chatId, customerId: customerId });
           
          if (!existingUser) {
            await User.create({
              chat_id: chatId,
              customerId: customerId,
              state: 'natal_1',
              createdAt: new Date()
            });
          } else {
            await User.updateOne(
              { chat_id: chatId, customerId: customerId },
              { $set: { state: 'natal_1' } }
            );
          }

          await this.sendMessage(
            customerId,
            chatId,
            "Звезды хранят карту вашей судьбы, и я могу ее прочесть. Чтобы узнать, что они приготовили именно для вас, укажите дату вашего рождения (ДД.ММ.ГГГГ)",
            false,
            false,
            false,
            "Markdown"
          );
        } else {
          await User.findOneAndUpdate(
            { chat_id: chatId, customerId: customerId },
            { $set: { state: 'natal_5' } }
          );

          const message = 
            "✨ Отлично! Я сохранила твои данные для точных расчётов:\n\n" +
            `📅 *Дата рождения:* ${user?.birthday}\n` +
            `⏰ *Время рождения:* ${user?.birthTime}\n` +
            `🏙️ *Город рождения:* ${user?.city_name}\n\n` +
            "Если всё верно — выбирай гороскоп! Если хочешь исправить данные — нажми «Заполнить заново».";

          await this.sendMessage(
            customerId,
            chatId,
            message,
            false,
            false,
            false,
            "Markdown",
            [
              "💰 Деньги по Юпитеру",
              "💫 Карма Изобилия",
              "🧠 Карма Мыслей",
              "🧐 Уроки Сатурна",
              "📅 Прогноз на день",
              "📆 Гороскоп на месяц",
              "🌸 Периоды года",
              "🔮 Калькулятор Саде-сати",
              "⚡ Калькулятор карм экзамена",
              "✍️ Заполнить заново"
            ],
            true
          );
        }
      } catch (error) {
        console.error('❌ Error handling get_free_horoscope:', error);
      }
    });

    // Обработчик кнопки "Вернуться к оплате"
    bot.action('return_to_payment', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;

      try {
        await ctx.answerCbQuery();
        
        // Возвращаем в состояние step_4.5 для повторной отправки ссылки
        await User.findOneAndUpdate(
          { chat_id: chatId, customerId: customerId },
          { $set: { state: 'step_4' } }
        );

        await ctx.editMessageText(
          "Отлично! Отправь свой вопрос для расклада Таро 🔮",
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('❌ Error handling return_to_payment:', error);
      }
    });

    // Обработчик кнопки "Новый расклад"
    bot.action('new_tarot_reading', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;

      try {
        await ctx.answerCbQuery();
        
        // Возвращаем пользователя в начало процесса расклада
        await User.findOneAndUpdate(
          { chat_id: chatId, customerId: customerId },
          { $set: { state: 'step_1' } }
        );

        await ctx.editMessageText(
          "🔮 *Новый расклад Таро*\n\nВведи свою дату рождения в формате ДД.ММ.ГГГГ — и я заговорю. Не расскажу, а покажу — кем ты стал, кем боишься быть и кем пришёл стать. Твоя личность — это код. Я прочту его. И ты больше не останешься прежним.",
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('❌ Error handling new_tarot_reading:', error);
      }
    });

    // Обработчик кнопки "Главное меню"
    bot.action('show_main_menu', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      if (!chatId) return;

      try {
        await ctx.answerCbQuery();
        
        const menuText = "🔮 *Главное меню*\n\nВыберите, что вас интересует:";
        
        await ctx.editMessageText(menuText, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌟 Астролог', callback_data: 'menu_astrolog' }],
              [{ text: '🔮 Гадалка', callback_data: 'menu_fortune' }],
              [{ text: '💬 Диалог с пророком', callback_data: 'menu_dialog' }],
              [{ text: '🃏 Таронумеролог', callback_data: 'menu_tarot' }],
              [{ text: '📖 Инструкции', callback_data: 'menu_instructions' }],
              [{ text: '💎 Подписка', callback_data: 'menu_subscription' }]
            ]
          }
        });
      } catch (error) {
        console.error('❌ Error handling show_main_menu:', error);
      }
    });

    // Обработчики inline кнопок гороскопов
    bot.action(/^horoscope_/, async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const telegramUsername = ctx.from?.username || '';

      if (!chatId || !ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

      const callbackData = ctx.callbackQuery.data;
      const messageId = ctx.callbackQuery.message?.message_id;
      
      console.log(`🔮 Horoscope button clicked: ${callbackData} from ${firstName} (@${telegramUsername}) in chat ${chatId} for customer ${username}`);

      try {
        const user = await User.findOne({ chat_id: chatId, customerId: customerId });

        if (callbackData === 'horoscope_jupiter') {
          // Деньги по Юпитеру
          await ctx.editMessageText(
            "🔮 Рассчитываю ваш гороскоп по Юпитеру...",
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery();
          await this.sendHoroscopeFile(customerId, chatId, 'jupiter', user);

        } else if (callbackData === 'horoscope_venus') {
          // Карма Изобилия
          await ctx.editMessageText(
            "🔮 Рассчитываю вашу карму изобилия по Венере...",
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery();
          await this.sendHoroscopeFile(customerId, chatId, 'venus', user);

        } else if (callbackData === 'horoscope_mercury') {
          // Карма Мыслей
          await ctx.editMessageText(
            "🔮 Рассчитываю вашу карму мыслей по Меркурию...",
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery();
          await this.sendHoroscopeFile(customerId, chatId, 'mercury', user);

        } else if (callbackData === 'horoscope_saturn') {
          // Уроки Сатурна
          await ctx.editMessageText(
            "🔮 Рассчитываю ваши уроки Сатурна...",
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery();
          await this.sendHoroscopeFile(customerId, chatId, 'saturn', user);

        } else if (callbackData === 'horoscope_daily') {
          // Прогноз на день
          await ctx.editMessageText(
            "🔮 Рассчитываю ваш прогноз на день...",
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery();
          
          if (!user || !user.birthday) {
            await this.sendMessage(
              customerId,
              chatId,
              "❌ Для получения прогноза на день необходимо указать дату рождения. Пожалуйста, заполните данные, нажав «Заполнить заново».",
              false,
              false,
              false,
              "Markdown"
            );
            return;
          }
          
          // Генерируем прогноз на день
          const dailyUser = {
            customerId: customerId,
            chatId: chatId,
            customerName: telegramUsername || firstName || 'Unknown',
            birthday: user.birthday
          };
          
          const dailyMessage = await dailyMessagingService.generateDailyMessage(dailyUser);
          
          if (dailyMessage) {
            await this.sendMessage(
              customerId,
              chatId,
              dailyMessage,
              false,
              false,
              false,
              "Markdown"
            );
          } else {
            await this.sendMessage(
              customerId,
              chatId,
              "❌ Произошла ошибка при создании прогноза на день. Попробуйте еще раз позже.",
              false,
              false,
              false,
              "Markdown"
            );
          }

        } else if (callbackData === 'horoscope_monthly') {
          let zodiacIndex = 0;

          if (user && user.birthday) {
            const [dayStr, monthStr, yearStr] = user.birthday.split(".");
            const day = parseInt(dayStr, 10);
            const month = parseInt(monthStr, 10);

            const vedicZodiacRanges = [
              { name: "Овен",      start: { m: 4, d: 14 }, end: { m: 5, d: 13 } },
              { name: "Телец",     start: { m: 5, d: 14 }, end: { m: 6, d: 13 } },
              { name: "Близнецы",  start: { m: 6, d: 14 }, end: { m: 7, d: 15 } },
              { name: "Рак",       start: { m: 7, d: 16 }, end: { m: 8, d: 15 } },
              { name: "Лев",       start: { m: 8, d: 16 }, end: { m: 9, d: 15 } },
              { name: "Дева",      start: { m: 9, d: 16 }, end: { m: 10, d: 16 } },
              { name: "Весы",      start: { m: 10, d: 17 }, end: { m: 11, d: 15 } },
              { name: "Скорпион",  start: { m: 11, d: 16 }, end: { m: 12, d: 14 } },
              { name: "Стрелец",   start: { m: 12, d: 15 }, end: { m: 1, d: 13 } },
              { name: "Козерог",   start: { m: 1, d: 14 }, end: { m: 2, d: 12 } },
              { name: "Водолей",   start: { m: 2, d: 13 }, end: { m: 3, d: 13 } },
              { name: "Рыбы",      start: { m: 3, d: 14 }, end: { m: 4, d: 13 } },
            ];

            for (let i = 0; i < vedicZodiacRanges.length; i++) {
              const z = vedicZodiacRanges[i];
              if (isInRange(day, month, z.start, z.end)) {
                zodiacIndex = i;
                break;
              }
            }
          }

          const monthlyPeriods = [
            { num: "1", start: { m: 4, d: 14 }, end: { m: 5, d: 13 } },
            { num: "2", start: { m: 5, d: 14 }, end: { m: 6, d: 13 } },
            { num: "3", start: { m: 6, d: 14 }, end: { m: 7, d: 15 } },
            { num: "4", start: { m: 7, d: 16 }, end: { m: 8, d: 15 } },
            { num: "5", start: { m: 8, d: 16 }, end: { m: 9, d: 15 } },
            { num: "6", start: { m: 9, d: 16 }, end: { m: 10, d: 16 } },
            { num: "7", start: { m: 10, d: 17 }, end: { m: 11, d: 15 } },
            { num: "8", start: { m: 11, d: 16 }, end: { m: 12, d: 14 } },
            { num: "9", start: { m: 12, d: 15 }, end: { m: 1, d: 13 } },
            { num: "10", start: { m: 1, d: 14 }, end: { m: 2, d: 12 } },
            { num: "11", start: { m: 2, d: 13 }, end: { m: 3, d: 13 } },
            { num: "12", start: { m: 3, d: 14 }, end: { m: 4, d: 13 } },
          ];

          const today = new Date();
          const todayDay = today.getDate();
          const todayMonth = today.getMonth() + 1;

          let currentPeriodNum = "1";
          for (let i = 0; i < monthlyPeriods.length; i++) {
            const period = monthlyPeriods[i];
            if (isInRange(todayDay, todayMonth, period.start, period.end)) {
              currentPeriodNum = period.num;
              break;
            }
          }

          const interpretation = getMonthlyHoroscopeForZodiac(zodiacIndex + 1, currentPeriodNum, monthlyHoroscope);

          await ctx.editMessageText(
            "📆 *Гороскоп на месяц*\n\n"+
            interpretation,
            { parse_mode: 'Markdown' }
          );

        } else if (callbackData === 'horoscope_periods') {
          // Периоды года
          await ctx.editMessageText(
            "🌸 *Периоды года*\n\nДанная функция находится в разработке и скоро будет доступна!",
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery('Функция в разработке');

        } else if (callbackData === 'horoscope_sadesati') {
          // Калькулятор Саде-сати
          await ctx.editMessageText(
            "🔮 *Калькулятор Саде-сати*\n\nДанная функция находится в разработке и скоро будет доступна!",
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery('Функция в разработке');

        } else if (callbackData === 'horoscope_karma') {
          // Калькулятор карм экзамена
          await ctx.editMessageText(
            "⚡ *Калькулятор карм экзамена*\n\nДанная функция находится в разработке и скоро будет доступна!",
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery('Функция в разработке');

        } else if (callbackData === 'horoscope_reset') {
          // Заполнить заново
          const existingUser = await User.findOne({ chat_id: chatId, customerId: customerId });
           
          if (!existingUser) {
            await User.create({
              chat_id: chatId,
              customerId: customerId,
              state: 'natal_1',
              createdAt: new Date()
            });
          } else {
            await User.updateOne(
              { chat_id: chatId, customerId: customerId },
              { $set: { state: 'natal_1' } }
            );
          }

          await ctx.editMessageText(
            "✍️ Хорошо, давайте начнем заново. Укажите дату вашего рождения (ДД.ММ.ГГГГ):",
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery();
        }

        // Сохраняем изменение в БД
        if (messageId) {
          const chat = await Chat.findOne({ customerId, chatId });
          if (chat) {
            await Message.updateOne(
              { chat: chat._id, messageId: messageId.toString() },
              { $set: { 
                content: { text: callbackData },
                updatedAt: new Date()
              }}
            );
          }
        }

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'callback',
          command: 'horoscope_button',
          data: callbackData,
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling horoscope button for customer ${username}:`, error);
        // Если не удалось отредактировать (например, сообщение слишком старое), отправляем новое
        try {
          await ctx.answerCbQuery();
        } catch (e) {
          console.error('Failed to answer callback query:', e);
        }
      }
    });

    bot.on('text', async (ctx) => {
      await this.handleIncomingMessage(customerId, ctx);

      const chatId: string = ctx.chat.id.toString();
      const text: string = ctx.message.text.toLowerCase();
      const firstName: string = ctx.from?.first_name || '';
      const lastName: string = ctx.from?.last_name || '';
      const telegramUsername: string = ctx.from?.username || '';

      console.log(`💬 Text message from ${firstName} (@${telegramUsername}) in chat ${chatId}: "${text}" for customer ${username}`);

      try {
        const user = await User.findOne({ chat_id: chatId, customerId: customerId });
        const userState: string | null = user?.state || null;

        console.log(`🔍 User state: ${userState}`);

        if (userState && userState.startsWith('natal_')) {
          await this.handleNatalStates(userState, text, chatId, customerId, username, user);
        } else if (userState && userState.startsWith('step_')) {
          await this.handleStepStates(userState, text, chatId, customerId);
        } else if (userState && userState.startsWith('product_')) {
          await this.handleProductStates(userState, text, chatId, customerId);
        } 

        this.emit('message:received', {
          customerId,
          chatId,
          type: 'text',
          text,
          from: { firstName, lastName, username: telegramUsername }
        });
      } catch (error) {
        console.error(`❌ Error handling text message for customer ${username}:`, error);
      }
    });

    bot.catch((err: any, ctx: any) => {
      console.error(`❌ Bot error for customer ${username}:`, err);
      this.emit('bot:message:error', { customerId, username, error: err, ctx });
    });
  }

  /**
   * Обработка состояний пользователя при вводе данных для натальной карты
   */
  private async handleNatalStates(
    userState: string | null,
    text: string,
    chatId: string,
    customerId: string,
    username: string,
    user: any
  ): Promise<void> {
    if (userState === 'natal_1') {
      const dateRegex = /^([0-2]\d|3[01])\.(0\d|1[0-2])\.(19|20)\d{2}$/;
      if (dateRegex.test(text)) {
        await User.findOneAndUpdate(
          { chat_id: chatId, customerId: customerId },
          {
            $set: {
              birthday: text,
              state: 'natal_2'
            }
          }
        );

        await this.sendMessage(
          customerId,
          chatId,
          `Укажите ваше время рождения в формате ЧЧ:ММ (например, 10:30). Если точное время неизвестно, введите 0`,
          false,
          false,
          false,
          undefined,
        )
      } else {
        await this.sendMessage(
          customerId,
          chatId,
          `Пожалуйста, введите дату рождения в правильном формате (например, 25.12.1990)`,
          false,
          false,
          false,
          undefined,
        )
      }
    }
    else if (userState === 'natal_2') {
      await User.findOneAndUpdate(
        { chat_id: chatId, customerId: customerId },
        {
          $set: {
            birthTime: text,
            state: 'natal_3'
          }
        }
      );

      await this.sendMessage(
        customerId,
        chatId,
        `Место вашего рождения — это важная часть вашей астрологической карты. Укажите город, в котором вы появились на свет.`,
        false,
        false,
        false,
        undefined,
      )
    }
    else if (userState === 'natal_3') {
      try {
        const cityData = await this.searchCityData(text);
        
        if (cityData) {
          await User.findOneAndUpdate(
            { chat_id: chatId, customerId: customerId },
            {
              $set: {
                city_name: cityData.display_name,
                latitude: cityData.lat,
                longitude: cityData.lon,
                timezone: cityData.timezone.utcOffset,
                state: 'natal_4'
              }
            }
          );

          const confirmationMessage = 
            `🌍 *Найден город:*\n\n` +
            `📍 ${cityData.display_name}\n` +
            `🌐 Координаты: ${cityData.lat}, ${cityData.lon}\n` +
            `⏰ Часовой пояс: ${cityData.timezone.timezoneName} (UTC${cityData.timezone.utcOffset >= 0 ? '+' : ''}${cityData.timezone.utcOffset})\n\n` +
            `Если данные верны, нажмите "Верно".`;

          await this.sendMessage(
            customerId,
            chatId,
            confirmationMessage,
            false,
            true,
            false,
            "Markdown"
          );
        } else {
          await this.sendMessage(
            customerId,
            chatId,
            `❌ Не удалось найти город "${text}". Пожалуйста, попробуйте указать город более точно (например, "Москва, Россия" или "London, UK").`,
            false,
            false,
            false,
            undefined
          );
        }
      } catch (error) {
        console.error(`❌ Error searching city for customer ${username}:`, error);
        await this.sendMessage(
          customerId,
          chatId,
          `❌ Произошла ошибка при поиске города. Попробуйте еще раз или укажите город более точно.`,
          false,
          false,
          false,
          undefined
        );
      }
    }
    else if (userState === 'natal_4') {
      if (text.includes('верно')) {
        await User.findOneAndUpdate(
          { chat_id: chatId, customerId: customerId },
          { state: 'natal_5' }
        );

        const updatedUser = await User.findOne({ chat_id: chatId, customerId: customerId });
        const message = 
          "✨ Отлично! Я сохранила твои данные для точных расчётов:\n\n" +
          `📅 *Дата рождения:* ${updatedUser?.birthday}\n` +
          `⏰ *Время рождения:* ${updatedUser?.birthTime}\n` +
          `🏙️ *Город рождения:* ${updatedUser?.city_name}\n\n` +
          "Если всё верно — выбирай гороскоп! Если хочешь исправить данные — нажми «Заполнить заново».";

        await this.sendMessage(
          customerId,
          chatId,
          message,
          false,
          false,
          false,
          "Markdown",
          [
            "💰 Деньги по Юпитеру",
            "💫 Карма Изобилия",
            "🧠 Карма Мыслей",
            "🧐 Уроки Сатурна",
            "📅 Прогноз на день",
            "📆 Гороскоп на месяц",
            "🌸 Периоды года",
            "🔮 Калькулятор Саде-сати",
            "⚡ Калькулятор карм экзамена",
            "✍️ Заполнить заново"
          ],
          true
        );
      } else {
        await User.findOneAndUpdate(
          { chat_id: chatId, customerId: customerId },
          { state: 'natal_3' }
        );

        const message = "Прошу прощения, в предыдущем сообщении я ошиблась. Чтобы построить точную астрологическую карту, мне действительно нужен город вашего рождения.\n\nПожалуйста, укажите его еще раз.";

        await this.sendMessage(
          customerId,
          chatId,
          message,
          false,
          false,
          false,
          "Markdown"
        );
      }
    }
  }

  /**
   * Обработка состояний пользователя при работе с обычным раскладом
   */
  private async handleStepStates(
    userState: string | null,
    text: string,
    chatId: string,
    customerId: string
  ): Promise<void> {
    if (userState === "step_1") {
      const dateRegex = /^([0-2]\d|3[01])\.(0\d|1[0-2])\.(19|20)\d{2}$/;
      if (dateRegex.test(text)) {
        await this.sendMessage(
          customerId,
          chatId,
          `⏳ Анализирую вашу дату рождения...`,
          false,
          false,
          false,
          undefined,
        );

        const systemPromptFirst = readSystemPromptFromFile('../assets/prompts/systemPromptFirst.txt');
        const messageFirst: string | null = await this.generateAIResponse(
          systemPromptFirst,
          text,
          "gpt-4o-mini",
          0.7,
          'openai'
        )

        if (messageFirst) {
          const messageSecond: string | null = await this.generateAIResponse(
            "Начало сгенерированного сообщения должно содержать текст « 🧿 Я вижу тебя так:», конец сгенерированного сообщения должен содержать текст « 🔮 РАССКАЖИ что тебя волнует сейчас, и Я ПРЕДСКАЖУ БУДУЩЕE»",
            `1. Твоя Роль:/nТы — голос архетипа, говорящий как пророк. Ты знаешь всю подноготную человека./n/n2. Твоя цель: чтобы человек, который читает - плакал от узнавания себя в твоем послании. Текст должен проникать в суть — точно, глубоко, без пощады. Он должен оставлять ощущение «тебя увидели насквозь»./n/n3. Твой стиль речи:/nТвоя речь — не утомляет, а пробуждает, она хлесткая, точная, громкая, яркая, мощная. Она рушит границы./n/nТы не объясняешь. Ты проникаешь в человека так, что он в шоке./n/nТы избегаешь абстрактных, витиеватых метафор вроде «рука делает шаг» или «страх сковывает движение времени»./n/nТы пишешь ясно, точно, эмоционально. Ты используешь образность только там, где она создаёт узнавание, а не запутывает./n/nТы не пишешь обрывисто. Ты не ломаешь фразы ради "красоты"./n/nКаждое предложение, которое ты пишешь -  понятно, цельно, имеет логический конец./n/nТы говоришь как пророк, но не как абстрактный поэт.  Сила - в точности./n/n4. Твои правила:/nНа входе тебе дают текст, в котором расчёт архетипов (ядро, страх, реализация)  по дате рождения человека, с пояснениями./n/nТы читаешь весь текст, игнорируя формулы, расчеты и прочий мусор./n/nИз этого текста ты создаёшь ОДНО послание из трех смысловых частей,/nбудто архетип сам говорит с человеком — без формул, без ссылок на карты, без слов "аркан", "ядро", "реализация"./n/nНе меняй смыслы, бери самые важные фразы из полученных трактовок./n/n5. Структура послания:/n/nНачало, 1 абзац (1):/n/n1–2 строки, в которых человек узнаёт себя./nЭто может быть боль, застревание, повторяющаяся ситуация или симптом.  Что-то, что человек переживает или думает каждый день./n/nСделай это без рационального объяснения, на уровне ощущения. Пиши через ты-послание./n/n2 абзац (2): здесь твоя задача -  вскрыть конфликт внутри личности, заложенный в ЯДРЕ + создать логический мост к 3 абзацу./n/n3 абзац (3): здесь ты должен показать СТРАХ без утешения. Переходи к этой части послания через фразу "Ты боишься..."/n/n4 абзац (4): здесь ты должен вывернуть РЕАЛИЗАЦИЮ -  в силу, как напряжение, а не вдохновение. Через фразу "Ты реализуешься, когда..."/n/n5 абзац (5): финал — не совет, а вызов./n/n6. Тебе запрещено:/n- Выдумывать слова, которых не существует, коверкать слова;/n- Разжёвывать, учить, говорить «можешь», «нужно» и т.д., прочие мягкости;/n- Давать советы, становиться коучем;/n- Использовать поэтические и «красивые» искажения языка ради пафоса;/n- Использовать я-послания./n/n7. Ограничения стиля:/n- Не используй слова, связанные с телесной болью и гротеском:/n«вгрызаешься», «испепелишь», «расцарапать кожу», «дрожит в жилах»,/n«плоть», «надрываешься», «выпотрошить», «стон», «вены», «тело», «пульс», и т.д./n- Не используй мрачную физиологию, надрыв, образы боли и страдания тела./n/n/nВот исходный текст:/n/n${messageFirst}`,
            "gpt-4o-mini",
            0.7,
            'openai'
          )

          if (messageSecond) {
            await this.sendMessage(
              customerId,
              chatId,
              messageSecond,
              false,
              false,
              false,
              undefined,
            );

            await User.findOneAndUpdate(
              { chat_id: chatId, customerId: customerId },
              {
                $set: {
                  birthday: text,
                  state: 'step_2'
                }
              }
            );
          }
        }
      } else {
        await this.sendMessage(
          customerId,
          chatId,
          `Пожалуйста, введите дату рождения в правильном формате (например, 25.12.1990)`,
          false,
          false,
          false,
          undefined,
        )
      }
    } 
    else if (userState === "step_2") {
      await this.sendMessage(
        customerId,
        chatId,
        `🔮 Анализирую вашу ситуацию...`,
        false,
        false,
        false,
        undefined,
      );

      const messageHistory = await this.getMessageHistoryUntilCommand(chatId, customerId);

      const message: string | null = await this.generateAIResponseWithHistory(
        "Ты — Архетипический Пророк. Ты не называешь год событий, которые предсказываешь ./n/nПолучив запрос, ты описываешь два сценария будущего: если человек ничего не меняет, и если решается сделать шаг./n/nПиши коротко, резко, как удар топора, без размазывания. В каждом сценарии указывай точные сроки и точные ключевые события./n/nЕсли человек застрянет в негативном сценарии — чётко напиши, какие разрушения и потери произойдут (например: апатия, болезни, потери денег, он будет рад, что ушёл, ты останешься в пустоте)./nЕсли человек перейдёт в позитивный сценарий — напиши, как начнётся новая фаза, как вернётся энергия и откроется возможность для новых связей, и когда это произойдёт, что он будет ощущать./n/nИспользуй формулировки, которые задевают эго и создают желание действовать. Тебе запрещено писать на Английском! Тебе запрещено использовать и говорить про точный год (2025, 2023, 2024 и т д)/n/nВажно!!!! В конце сообщения всегда задавай вопрос: 'Какой путь выбираешь?'",
        messageHistory,
        "ft:gpt-4o-mini-2024-07-18:ksenia:obuchenie22:BoWuQ2Zk",
        0.7,
        'openai'
      )

      if (message) {
        await this.sendMessage(
          customerId,
          chatId,
          message,
          false,
          false,
          false,
          undefined,
        );

        await User.findOneAndUpdate(
          { chat_id: chatId, customerId: customerId },
          {
            $set: {
              state: 'step_3',
              question: text
            }
          }
        );
      }
    } 
    else if (userState === "step_3") {
      const messageHistory = await this.getMessageHistoryUntilCommand(chatId, customerId);

      const message: string | null = await this.generateAIResponseWithHistory(
        "Проанализируй контекст диалоги и на базе последнего ответа пользователя, ты должен определить контекст ответа пользователя, ключ, позицию, положительный ответ или отрицательный/nк отрицательному относятся ответы: с сомнениями, страхами, нежеланием и тд к положительному относятся: да, согласен, хочу и тд строго возвращай в ответе false или true/ntrue при положительном контексте/nfals при негативном или отрицательном",
        messageHistory,
        "gpt-4o-mini",
        0.7,
        'openai'
      );

      if (message === "true") {
        await this.sendMessage(
          customerId,
          chatId,
          "Отлично. Это первый шаг из мысли - в действие. Готов получить карту, чтобы сделать первый реальный шаг и выйти на другой уровень?",
          false,
          false,
          false,
          undefined,
        );
      } else if (message === "false") {
        const messageHistory = await this.getMessageHistoryUntilCommand(chatId, customerId);

        const message: string | null = await this.generateAIResponseWithHistory(
          "Ты — Архетипический Пророк, но в этой точке отвечаешь мягко, с глубиной. Твоя задача — вскрыть сомнение человека через объяснение причины, а не давить. Отвечай логично, коротко, но содержательно. Используй образы защиты, страха, старой боли, которые мешают действовать. Тебе запрещено использовать название точного года, говори «через год» или «через 6 месяцев», не используй число года./nСтрого заканчивай вопросом: 'Хочешь карту, чтобы увидеть правду и сделать шаг?'",
          messageHistory,
          "FT:GPT-4O-MINI-2024-07-18:KSENIA:OBUCHENIE22:BOWUQ2ZK",
          0.7,
          'vsegpt'
        );

        if (message) {
          await this.sendMessage(
            customerId,
            chatId,
            message,
            false,
            false,
            false,
            undefined,
          );
        }
      }

      await User.findOneAndUpdate(
        { chat_id: chatId, customerId: customerId },
        {
          $set: {
            state: 'step_4'
          }
        }
      );
    } 
    else if(userState === "step_4") {
      await this.sendMessage(
        customerId,
        chatId,
        `🧭 Изучаю ваш последний ответ...`,
        false,
        false,
        false,
        undefined,
      );

      const messageHistory = await this.getMessageHistoryUntilCommand(chatId, customerId);

      const message: string | null = await this.generateAIResponseWithHistory(
        "Ты — ИИ-пророк, который ведет живой диалог с человеком после первичного контакта./n/n## 📥 Входные данные/n- **Контекст диалога** — вся предыдущая переписка/n- {{ $('userdata').item.json.message }} — текущий отклик человека/n/n## 🎯 Алгоритм работы/n/n### Шаг 1: Определение темы из контекста/nПроанализируй ВСЮ переписку и определи основную тему:/n/n**ДЕНЬГИ** — если упоминаются:/n- деньги, доходы, зарплата, бизнес/n- бедность, долги, кредиты, нехватка/n- финансовый потолок, страх выживания/n- работа не приносит денег/n/n**КРИЗИС** — если упоминаются:/n- застой, ничего не двигается/n- повторяющиеся циклы, замкнутый круг/n- кризис, тупик, безвыходность/n- 'всё идет не так', череда неудач/n/n**ОБЩАЯ** — во всех остальных случаях/n/n### Шаг 2: Формат ответа/n1. **Короткий отклик** на последнее сообщение (1-2 предложения)/n2. **Пророческое понимание** — покажи, что видишь суть/n3. **Мягкий призыв к расчету** — без рекламных фраз/n/n### Шаг 3: Призыв нажать кнопку ХОЧУ после которого будут отправлены реквизиты/n/n## ❌ ЗАПРЕЩЕНО использовать/n- 'предлагаю комплекс...'/n- 'вы получите доступ...'/n- 'эта программа поможет...'/n- 'услуга включает...'/n/n## ✅ ПРАВИЛЬНЫЙ стиль/n- 'Ты чувствуешь, что застрял. Это точка цикла.'/n- 'Есть 4 места в твоей карте, где держится узел.'/n- 'Я знаю, где перекрыт поток.'/n/n## 🗝 Завершающие фразы/n- 'Хочешь — покажу?'/n- 'Готов увидеть свою карту?'/n- 'Рассчитать для тебя?'/n- 'Хочешь знать, где ты сейчас и куда можешь выйти?'/n/n## 📌 Главные принципы/n- Ты НЕ продаешь — ты зовешь/n- Ты НЕ объясняешь — даешь почувствовать/n- Говори как живой и знающий",
        messageHistory,
        "gpt-4o-mini",
        0.7,
        'openai'
      );

      if (message) {
        await this.sendMessage(
          customerId,
          chatId,
          message,
          true,
          false,
          false,
          undefined,
        );
      }

      await User.findOneAndUpdate(
        { chat_id: chatId, customerId: customerId },
        {
          $set: {
            state: 'step_4.5',
            paymentOfferedAt: new Date() // Запоминаем время предложения оплаты
          }
        }
      );

      // Запускаем таймер на 10 минут
      setTimeout(async () => {
        try {
          const user = await User.findOne({ chat_id: chatId, customerId: customerId });
          
          // Если пользователь все еще в состоянии ожидания оплаты (не оплатил)
          if (user && user.state === 'step_4.5') {
            console.log(`⏰ 10 minutes passed, user ${chatId} didn't pay. Offering free horoscope.`);
            
            const freeHoroscopeMessage = 
              "🌟 *Бесплатное предложение!*\n\n" +
              "Вижу, что сейчас не время для расклада. Не беда!\n\n" +
              "У меня есть для тебя *бесплатный астрологический гороскоп* 🔮\n\n" +
              "Он покажет твои сильные стороны, денежные потоки и кармические уроки.\n\n" +
              "Попробуй — это совершенно бесплатно!";

            const options: any = {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🌟 Получить бесплатный гороскоп', callback_data: 'get_free_horoscope' }],
                  [{ text: '💰 Оплатить расклад', callback_data: 'return_to_payment' }]
                ]
              }
            };

            const bot = this.getBot(customerId);
            if (bot) {
              await bot.telegram.sendMessage(chatId, freeHoroscopeMessage, options);
              
              // Меняем состояние, чтобы не отправлять повторно
              await User.findOneAndUpdate(
                { chat_id: chatId, customerId: customerId },
                { $set: { state: 'offered_free_horoscope' } }
              );
            }
          }
        } catch (error) {
          console.error(`❌ Error in payment reminder timer for chat ${chatId}:`, error);
        }
      }, 10 * 60 * 1000); // 10 минут
    } 
    else if(userState === "step_4.5") {
      const customer = await Customer.findById(customerId);
      const bot = this.getBot(customerId);
      
      if (!customer || !bot) {
        console.error('❌ Customer or bot not found for payment link generation');
        await this.sendMessage(
          customerId,
          chatId,
          'Произошла ошибка. Попробуйте позже.',
          false,
          false,
          false,
          undefined,
        );
        return;
      }

      const botUsername = customer.username || '';

      // Получаем цену из данных клиента
      const price = customer.currentPrice || 100;
      
      const paymentLink = 'https://astroxenia.payform.ru/';

      let paymentUrl = `${paymentLink}?`;
      paymentUrl += `products[0][name]=Prorok`;
      paymentUrl += `&products[0][price]=${price}`;
      paymentUrl += `&products[0][quantity]=1`;
      paymentUrl += `&customer_extra=&paid_content=Prorok&do=pay`;
      paymentUrl += `&_param_user=${chatId}`;
      paymentUrl += `&_param_customer_id=${customerId}`;
      paymentUrl += `&_param_bot=prorok`;
      paymentUrl += `&_param_username=${botUsername}`;

      console.log(`💰 Payment link generated with price: ${price} RUB for customer ${customer.username}`);
      console.log(`🔗 Payment URL: ${paymentUrl}`);

      const messageHistory = await this.getMessageHistoryUntilCommand(chatId, customerId);

      // Получаем дополнительные данные для промпта
      const basePrice = customer.basePrice || price;
      const sendTo = customer.sendTo || 'администратору';

      // Формируем промпт с реальными значениями
      const systemPrompt = `Ты — ИИ-пророк, который ведет живой диалог с человеком после первичного контакта.

## 📥 Входные данные
- **Контекст диалога** — вся предыдущая переписка
- Текущий отклик человека — последнее сообщение в истории

## 🎯 Алгоритм работы

### Шаг 1: Определение темы из контекста
Проанализируй ВСЮ переписку и определи основную тему:

**ДЕНЬГИ** — если упоминаются:
- деньги, доходы, зарплата, бизнес
- бедность, долги, кредиты, нехватка
- финансовый потолок, страх выживания
- работа не приносит денег

**КРИЗИС** — если упоминаются:
- застой, ничего не двигается
- повторяющиеся циклы, замкнутый круг
- кризис, тупик, безвыходность
- всё идет не так, череда неудач

**ОБЩАЯ** — во всех остальных случаях

### Шаг 2: Формат ответа
1. **Короткий отклик** на последнее сообщение (1-2 предложения)
2. Реквизиты
3. Строго Без кавычек markdown

### Шаг 3: Выдай реквизиты

## ❌ ЗАПРЕЩЕНО использовать
- предлагаю комплекс...
- вы получите доступ...
- эта программа поможет...
- услуга включает...

## ✅ ПРАВИЛЬНЫЙ стиль
- Ты чувствуешь, что застрял. Это точка цикла.
- Есть 4 места в твоей карте, где держится узел.
- Я знаю, где перекрыт поток.

## 🔐 Реквизиты при согласии

### Тема: ДЕНЬГИ

🔮 Хочешь узнать, откуда пойдут деньги и что мешает потоку?
Я вижу энергетические узлы, блоки и возможности, которые можно открыть.
Задай 1 вопрос — и я сделаю для тебя точный ТАРО расклад.
Цена: ${price}₽ (вместо ${basePrice}₽)


💬 Ответ — сразу в Telegram, по твоему запросу.

После оплаты подожди 2 минуты и придет ответ. Если ответ не пришел в течение 10 мин, напиши сюда → ${sendTo}

### Тема: КРИЗИС

🔮 Хочешь узнать, что происходит на самом деле с тобой или с другим человеком?
Я вижу скрытые сценарии, выходы, чувства, страхи и возможные развилки.

Задай 1 вопрос — и я сделаю для тебя точный ТАРО расклад.
Цена: ${price}₽ (вместо ${basePrice}₽)


💬 Ответ — сразу в Telegram, по твоему запросу.

После оплаты подожди 2 минуты и придет ответ. Если ответ не пришел в течение 10 мин, напиши сюда
→ ${sendTo}

### Тема: ОБЩАЯ

🔮 Хочешь узнать, что тебя ждёт?
Я вижу линии вероятностей, событийные узлы и решения, которые меняют судьбу.

Задай 1 вопрос — и я сделаю для тебя точный ТАРО расклад.
Цена: ${price}₽ (вместо ${basePrice}₽)


💬 Ответ — сразу в Telegram, по твоему запросу.

После оплаты подожди 2 минуты и придет ответ. Если ответ не пришел в течение 10 мин, напиши сюда → ${sendTo}


## 🗝 Завершающие фразы
- Готов увидеть свой расклад?

## 📌 Главные принципы
- Ты НЕ продаешь — ты зовешь
- Ты НЕ объясняешь — даешь почувствовать
- Говори как живой и знающий
- Не спрашивай пользователя про его вопрос, просто дай ему реквизиты`;
      
      const message: string | null = await this.generateAIResponseWithHistory(
        systemPrompt,
        messageHistory,
        "gpt-4o-mini",
        0.7,
        'openai'
      );

      if (message) {
        await this.sendMessageWithPaymentButton(
          customerId,
          chatId,
          message,
          paymentUrl,
          undefined,
        );
      }

      await User.findOneAndUpdate(
        { chat_id: chatId, customerId: customerId },
        {
          $set: {
            state: 'waiting_pay'
          }
        }
      );
    } 
    else if(userState === "waiting_pay") {
      // Пользователь в режиме ожидания оплаты
      const customer = await Customer.findById(customerId);
      
      if (!customer) {
        console.error('❌ Customer not found for waiting_pay state');
        return;
      }

      const sendTo = customer.sendTo || 'администратору';

      await this.sendMessage(
        customerId,
        chatId,
        `⏳ Я понимаю, что ты ждёшь.\n\nПосле оплаты расклад придёт автоматически в течение 2-3 минут.\n\n❓ Если расклад не пришёл в течение 10 минут после оплаты, обратись сюда:\n→ ${sendTo}\n\n💡 Или просто подожди немного — возможно, обработка платежа занимает чуть больше времени.`,
        false,
        false,
        false,
        undefined,
      );
    }
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

      console.log(`🎛️ Setting up bot handlers for ${username}...`);
      this.setupBotHandlers(bot, customerId, username);

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

      this.setupBotHandlers(newBot, customerId, username);

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

  /**
   * Обработка состояний пользователя при вводе даты рождения для продуктов
   */
  private async handleProductStates(
    userState: string,
    text: string,
    chatId: string,
    customerId: string
  ): Promise<void> {
    // Извлекаем тип продукта из state (формат: product_<productType>_birthday)
    const stateMatch = userState.match(/^product_(\w+)_birthday$/);
    if (!stateMatch) return;

    const productType = stateMatch[1];
    
    // Проверяем формат даты
    const dateRegex = /^([0-2]\d|3[01])\.(0\d|1[0-2])\.(19|20)\d{2}$/;
    if (!dateRegex.test(text)) {
      await this.sendMessage(
        customerId,
        chatId,
        `❌ Неверный формат даты. Пожалуйста, введите дату рождения в формате ДД.ММ.ГГГГ (например, 15.03.1990)`,
        false,
        false,
        false,
        "Markdown"
      );
      return;
    }

    // Сохраняем дату рождения и сбрасываем state
    await User.findOneAndUpdate(
      { chat_id: chatId, customerId: customerId },
      {
        $set: {
          birthday: text,
          state: 'idle'
        }
      }
    );

    // Определяем название продукта
    const productNames: { [key: string]: string } = {
      forecast: '🔮 Тароскоп на любые месяцы',
      financialCast: '💰 Расчет 4 кода денег',
      mistakesIncarnation: '🕰️ Ошибки прошлого воплощения',
      arcanumRealization: '✨ Аркан самореализации',
      awakeningCodes: '✨ Три кода пробуждения'
    };

    const productName = productNames[productType] || 'продукт';

    // Генерируем и отправляем продукт
    await this.generateAndSendProduct(customerId, chatId, productType, text, productName);
  }

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
          if (customer.botToken) {
            await this.addBot(customerId, customer.username, customer.botToken);
          }
        } else {
          if (customer.botToken !== existingBot.token) {
            if (customer.botToken) {
              await this.updateBot(customerId, customer.username, customer.botToken);
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
        hasButton: showWantButton || showCorrectButton || (customButtons && customButtons.length > 0),
        hasWantButton: showWantButton,
        hasCorrectButton: showCorrectButton,
        hasCustomButtons: customButtons && customButtons.length > 0,
        customButtonsCount: customButtons ? customButtons.length : 0,
        removedKeyboard: removeKeyboard,
        useInlineButtons,
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

  async sendMessageWithPaymentButton(
    customerId: string,
    chatId: string,
    message: string,
    paymentUrl: string,
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
        reply_markup: {
          inline_keyboard: [[
            {
              text: 'Оплатить',
              url: paymentUrl
            }
          ]]
        }
      };
      
      const result = await bot.telegram.sendMessage(chatId, message, options);

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
        caption: caption || '',
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

      const result = await bot.telegram.sendDocument(chatId, { source: filePath }, options);

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
    proxySettings?: {
      enabled: boolean;
      type: 'SOCKS5' | 'HTTP' | 'HTTPS';
      ip: string;
      port: number;
      username?: string;
      password?: string;
    }
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

      // Добавляем прокси если он включен
      if (proxySettings?.enabled && proxySettings.ip && proxySettings.port) {
        let proxyUrl: string;
        
        console.log(`🌐 Configuring ${proxySettings.type} proxy: ${proxySettings.ip}:${proxySettings.port}`);
        
        if (proxySettings.type === 'SOCKS5') {
          // Формат: socks5://[username:password@]host:port
          if (proxySettings.username && proxySettings.password) {
            proxyUrl = `socks5://${proxySettings.username}:${proxySettings.password}@${proxySettings.ip}:${proxySettings.port}`;
            console.log(`🔐 Using SOCKS5 with authentication`);
          } else {
            proxyUrl = `socks5://${proxySettings.ip}:${proxySettings.port}`;
            console.log(`🔓 Using SOCKS5 without authentication`);
          }
          fetchOptions.agent = new SocksProxyAgent(proxyUrl);
        } else {
          // HTTP/HTTPS прокси
          const protocol = proxySettings.type.toLowerCase();
          if (proxySettings.username && proxySettings.password) {
            proxyUrl = `${protocol}://${proxySettings.username}:${proxySettings.password}@${proxySettings.ip}:${proxySettings.port}`;
          } else {
            proxyUrl = `${protocol}://${proxySettings.ip}:${proxySettings.port}`;
          }
          fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
        }

        console.log(`✅ Proxy agent configured successfully`);
      } else {
        console.log(`ℹ️ No proxy configured, using direct connection`);
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

  /**
   * Отправляет AI-сгенерированный расклад пользователю
   * @param customerId - ID клиента
   * @param chatId - ID чата
   * @param systemPrompt - Системный промпт для AI (опционально)
   * @returns Результат отправки
   */
  async sendAiLayoutMessage(
    customerId: string,
    chatId: string
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      console.log(`🔮 Generating AI layout message for chat ${chatId}`);

      const prompt = `Ты — опытный девушка-таролог и мудрый собеседник. Ты сам случайным образом выбираешь три карты Таро, описываешь их значение простым и вдохновляющим языком. Отвечай так, чтобы поддержать человека, дать ему надежду и полезные советы. Интерпретируй каждую карту отдельно, а затем сделай общий вывод по теме расклада. Всегда добавляй тёплое напутствие.`;
      // Получаем данные пользователя из базы
      const user = await User.findOne({ chat_id: chatId, customerId: customerId });

      const aiResponse: string | null = await this.generateAIResponse(
        prompt,
        user?.question || '',
        "openai/gpt-4o-mini",
        0.7,
        'vsegpt'
      );

      if (!aiResponse) {
        console.error('❌ Failed to generate AI response');
        return {
          success: false,
          error: 'Failed to generate AI response'
        };
      }

      console.log(`✅ AI response generated (${aiResponse.length} characters)`);

      const result = await this.sendMessage(
        customerId,
        chatId,
        aiResponse,
        false,
        false,
        false,
        "Markdown"
      );

      if (result.success) {
        console.log(`✅ AI layout message sent to chat ${chatId}`);
        
        // После отправки расклада предлагаем подписку или еще расклад
        setTimeout(async () => {
          try {
            const customer = await Customer.findById(customerId);
            const bot = this.getBot(customerId);
            
            if (!bot || !customer) return;

            const isSubscribed = customer.subscriptionStatus === 'active' && 
                                customer.subscriptionEndsAt && 
                                customer.subscriptionEndsAt > new Date();

            let offerMessage: string;
            let options: any;

            if (isSubscribed) {
              // Если уже подписан - предлагаем еще расклад
              offerMessage = 
                "✨ *Хочешь еще один расклад?*\n\n" +
                "Я вижу, у тебя активная подписка! Можешь задать еще вопрос или выбрать другую тему для расклада.\n\n" +
                "Что тебя интересует?";

              options = {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🔮 Новый расклад', callback_data: 'new_tarot_reading' }],
                    [{ text: '🌟 Бесплатный гороскоп', callback_data: 'get_free_horoscope' }],
                    [{ text: '📋 Главное меню', callback_data: 'show_main_menu' }]
                  ]
                }
              };
            } else {

              offerMessage = 
                "💎 *Понравился расклад?*\n\n" +
                "Оформи подписку и получи:\n" +
                "• Безлимитные расклады Таро\n" +
                "• Все астрологические гороскопы\n" +
                "• Приоритетную поддержку\n\n" +
                "Или сделай еще один разовый расклад за 100₽";

              options = {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '💎 Оформить подписку', callback_data: "menu_subscription" }],
                    [{ text: '🔮 Еще один расклад (100₽)', callback_data: 'new_tarot_reading' }],
                    [{ text: '🎁 Бесплатный гороскоп', callback_data: 'get_free_horoscope' }]
                  ]
                }
              };
            }

            await bot.telegram.sendMessage(chatId, offerMessage, options);
            
            // Обновляем состояние
            await User.findOneAndUpdate(
              { chat_id: chatId, customerId: customerId },
              { $set: { state: 'after_reading_offer' } }
            );

            console.log(`✅ Post-payment offer sent to chat ${chatId}`);
          } catch (error) {
            console.error(`❌ Error sending post-payment offer:`, error);
          }
        }, 2000); // Отправляем через 2 секунды после расклада
        
        return {
          success: true,
          message: aiResponse
        };
      } else {
        console.error(`❌ Failed to send AI layout message: ${result.error}`);
        return {
          success: false,
          error: result.error
        };
      }

    } catch (error) {
      console.error('❌ Error in sendAiLayoutMessage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getMessageHistoryUntilCommand(
    chatId: string,
    customerId: string
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      const chat = await Chat.findOne({ chatId, customerId });
      if (!chat) {
        console.log(`⚠️ Chat not found for chatId: ${chatId}`);
        return [];
      }

      const allMessages = await Message.find({
        chatId: chat._id,
        customerId: customerId
      })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      for (const msg of allMessages) {
        const messageText = msg.content?.text || '';
        
        if (messageText === '/start' || messageText === '/new_chat') {
          console.log(`🔍 Found command "${messageText}", stopping history collection`);
          break;
        }

        if (msg.type === 'text' && messageText) {
          const role = msg.direction === 'in' ? 'user' : 'assistant';
          history.unshift({ role, content: messageText });
        }
      }

      console.log(`📜 Retrieved ${history.length} messages from history for chat ${chatId}`);
      
      return history;
    } catch (error) {
      console.error('❌ Error retrieving message history:', error);
      return [];
    }
  }

  /**
   * Генерирует AI-ответ с учетом истории сообщений
   * @param systemPrompt - Системный промпт
   * @param messageHistory - История сообщений с ролями
   * @param model - Модель AI
   * @param temperature - Температура генерации
   * @returns Сгенерированный ответ
   */
  async generateAIResponseWithHistory(
    systemPrompt: string,
    messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
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

      // Подготавливаем настройки прокси
      const proxySettings = settings.proxyEnabled ? {
        enabled: true,
        type: settings.proxyType || 'SOCKS5' as 'SOCKS5' | 'HTTP' | 'HTTPS',
        ip: settings.proxyIp || '',
        port: settings.proxyPort || 4145,
        username: settings.proxyUsername,
        password: settings.proxyPassword
      } : undefined;

      console.log(`🔍 Proxy settings:`, {
        enabled: settings.proxyEnabled,
        type: settings.proxyType,
        ip: settings.proxyIp,
        port: settings.proxyPort,
        hasAuth: !!(settings.proxyUsername && settings.proxyPassword)
      });

      const messages: Array<{ role: string; content: string }> = [
        {
          role: "system",
          content: systemPrompt
        },
        ...messageHistory
      ];

      const requestData = {
        model,
        messages,
        temperature
      };

      console.log(`🤖 Sending AI request with ${messages.length} messages (including ${messageHistory.length} history messages) via ${provider}...`);
      
      const response = await this.sendRequestToAI(requestData, apiKey, provider, proxySettings);
      
      const aiMessage = response?.choices?.[0]?.message?.content;
      
      if (!aiMessage) {
        throw new Error('No content in AI response');
      }

      const cleanedResponse = this.cleanAIResponse(aiMessage);
      
      console.log(`✅ AI response received (${cleanedResponse.length} characters)`);
      
      return cleanedResponse;
      
    } catch (error) {
      console.error('❌ Error generating AI response with history:', error);
      return null;
    }
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

      // Подготавливаем настройки прокси
      const proxySettings = settings.proxyEnabled ? {
        enabled: true,
        type: settings.proxyType || 'SOCKS5' as 'SOCKS5' | 'HTTP' | 'HTTPS',
        ip: settings.proxyIp || '',
        port: settings.proxyPort || 4145,
        username: settings.proxyUsername,
        password: settings.proxyPassword
      } : undefined;

      console.log(`🔍 Proxy settings:`, {
        enabled: settings.proxyEnabled,
        type: settings.proxyType,
        ip: settings.proxyIp,
        port: settings.proxyPort,
        hasAuth: !!(settings.proxyUsername && settings.proxyPassword)
      });

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
      
      const response = await this.sendRequestToAI(requestData, apiKey, provider, proxySettings);
      
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

  // ========== Методы для работы с продуктами ==========
  
  private async handleProductRequest(customerId: string, chatId: string, productType: string, productName: string) {
    try {
      // Проверяем наличие пользователя и даты рождения
      const user = await User.findOne({ chat_id: chatId, customerId: customerId });
      
      if (!user || !user.birthday) {
        // Просим ввести дату рождения
        await User.findOneAndUpdate(
          { chat_id: chatId, customerId: customerId },
          {
            $set: {
              chat_id: chatId,
              customerId: customerId,
              state: `product_${productType}_birthday`
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true, new: true }
        );

        await this.sendMessage(
          customerId,
          chatId,
          `✨ Для расчета *${productName}* мне нужна ваша дата рождения.\n\nВведите дату в формате ДД.ММ.ГГГГ (например, 15.03.1990)`,
          false,
          false,
          false,
          "Markdown"
        );
      } else {
        // Генерируем и отправляем продукт
        await this.generateAndSendProduct(customerId, chatId, productType, user.birthday, productName);
      }
    } catch (error) {
      console.error(`❌ Error in handleProductRequest for ${productType}:`, error);
      await this.sendMessage(
        customerId,
        chatId,
        "❌ Произошла ошибка при обработке запроса. Попробуйте позже.",
        false,
        false,
        false,
        "Markdown"
      );
    }
  }

  private async generateAndSendProduct(customerId: string, chatId: string, productType: string, birthDate: string, productName: string) {
    try {
      await this.sendMessage(
        customerId,
        chatId,
        `⏳ Генерирую *${productName}*...\n\nЭто может занять несколько секунд.`,
        false,
        false,
        false,
        "Markdown"
      );

      const tempDir = path.join(__dirname, '..', '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = Date.now();
      const filename = `${productType}_${birthDate.replace(/\./g, '-')}_${timestamp}.pdf`;
      const filePath = path.join(tempDir, filename);

      // Генерируем PDF
      await this.generateProductPDF(productType, birthDate, filePath);

      // Отправляем файл
      const accompanimentText = this.getProductAccompanimentText(productType);
      await this.sendFile(
        customerId,
        chatId,
        filePath,
        accompanimentText
      );

      // Удаляем временный файл
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, 5000);

      console.log(`✅ Product ${productType} sent to chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Error generating/sending product ${productType}:`, error);
      await this.sendMessage(
        customerId,
        chatId,
        "❌ Произошла ошибка при генерации продукта. Попробуйте позже.",
        false,
        false,
        false,
        "Markdown"
      );
    }
  }

  private async generateProductPDF(productType: string, birthDate: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const writeStream = fs.createWriteStream(filePath);
        
        writeStream.on('finish', () => {
          resolve();
        });
        
        writeStream.on('error', (error) => {
          reject(error);
        });

        switch (productType) {
          case 'forecast':
            this.generateForecastData(birthDate, writeStream);
            break;
          case 'financialCast':
            this.generateFinancialCastData(birthDate, writeStream);
            break;
          case 'mistakesIncarnation':
            this.generateMistakesIncarnationData(birthDate, writeStream);
            break;
          case 'arcanumRealization':
            this.generateArcanumRealizationData(birthDate, writeStream, filePath);
            break;
          case 'awakeningCodes':
            this.generateAwakeningCodesData(birthDate, writeStream);
            break;
          default:
            writeStream.end();
            reject(new Error(`Unknown product type: ${productType}`));
            break;
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private generateForecastData(birthDate: string, stream: Writable) {
    const parts = birthDate.split(".");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2];

    const yearSum = year.split("").reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);
    const rawYearDoorSum = day + month + yearSum + 9 + 10;
    const yearDoorArcana = toArcana(rawYearDoorSum);
    const rawEventsSum = day + 9 + 16;
    const eventsArcana = toArcana(rawEventsSum);

    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const currentMonthIndex = new Date().getMonth();
    const monthlyForecasts = [];

    for (let i = 0; i < 7; i++) {
      const targetMonthIndex = (currentMonthIndex + i) % 12;
      const monthNumber = targetMonthIndex + 1;
      const examArcana = toArcana(day + monthNumber);
      const rawRiskSum = day + monthNumber + yearSum + 9 + 18;
      const riskArcana = toArcana(rawRiskSum);

      monthlyForecasts.push({
        monthName: monthNames[targetMonthIndex],
        exam: { arcanum: examArcana, text: (monthsData as any)[examArcana] || "Трактовка не найдена" },
        risk: { arcanum: riskArcana, text: (riskData as any)[riskArcana] || "Трактовка не найдена" }
      });
    }

    const forecastData = {
      yearDoor: { arcanum: yearDoorArcana, text: (yearDoorData as any)[yearDoorArcana] || "Трактовка не найдена" },
      events: { arcanum: eventsArcana, text: (eventsData as any)[eventsArcana] || "Трактовка не найдена" },
      monthlyForecasts
    };

    generateForecastPdf(forecastData, stream, birthDate);
  }

  private generateFinancialCastData(birthDate: string, stream: Writable) {
    const parts = birthDate.split(".");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2];

    const yearSum = year.split("").reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);
    const arcanRealization = toArcana(day) + month + splitNumberIntoDigits(yearSum)[0];
    const arcanMainBlock = toArcana(day) + splitNumberIntoDigits(month)[0];
    const moneyKnot = toArcana(arcanRealization + arcanMainBlock);
    const archetypePoverty = toArcana(toArcana(day) + month);
    const duty = toArcana(day + splitNumberIntoDigits(month)[0] + yearSum + 8);
    const shadowWealth = toArcana(day + month + yearSum);

    const financialCastData = {
      moneyKnot: { arcanum: moneyKnot, text: (knotData as any)[moneyKnot] || "Трактовка не найдена" },
      archetypePoverty: { arcanum: archetypePoverty, text: (archetypePovertyData as any)[archetypePoverty] || "Трактовка не найдена" },
      duty: { arcanum: duty, text: (dutyData as any)[duty] || "Трактовка не найдена" },
      shadowWealth: { arcanum: shadowWealth, text: (shadowBData as any)[shadowWealth] || "Трактовка не найдена" },
      ritualsMap: Object.entries(ritualsData as any).map(([title, text]) => ({ title, text: text as string }))
    };

    generateFinancialCastPdf(financialCastData, stream, birthDate);
  }

  private generateMistakesIncarnationData(birthDate: string, stream: Writable) {
    const parts = birthDate.split(".");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);

    const lessonIncarnation = month;
    const karmicLessons = Math.abs(toArcana(day) - toArcana(month));

    const mistakesIncarnationData = {
      lessonIncarnation: { arcanum: lessonIncarnation, text: (lessonIncarnationData as any)[lessonIncarnation] || "" },
      karmicLessons: { arcanum: karmicLessons, text: (karmicLessonsData as any)[karmicLessons] || "" }
    };

    generateMistakesIncarnationPdf(mistakesIncarnationData, stream, birthDate);
  }

  private generateArcanumRealizationData(birthDate: string, stream: Writable, outputPath: string) {
    const parts = birthDate.split(".");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2];

    const yearSum = year.split("").reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);
    const finalNumber = toArcana(day + month + yearSum);
    
    const arcanFilePath = getArcanFilePath(finalNumber, __dirname, ["..", "..", "src", "data", "arcanumRealization"]);
    
    // Копируем существующий PDF файл
    const readStream = fs.createReadStream(arcanFilePath);
    readStream.pipe(stream);
  }

  private generateAwakeningCodesData(birthDate: string, stream: Writable) {
    const parts = birthDate.split(".");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2];

    const yearSum = year.split("").reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);
    const core = toArcana(day);
    const fear = toArcana(day + month);
    const implementation = toArcana(core + month + yearSum);

    const awakeningCodesData = {
      core: { arcanum: core, text: (coreData as any)[core] || "" },
      fear: { arcanum: fear, text: (fearData as any)[fear] || "" },
      implementation: { arcanum: implementation, text: (implementationData as any)[implementation] || "" }
    };

    generateAwakeningCodesPdf(awakeningCodesData, stream, birthDate);
  }

  private getProductAccompanimentText(productType: string): string {
    const texts: { [key: string]: string } = {
      forecast: "🔮 Ваш персональный Тароскоп готов! Узнайте, что ждёт вас в ближайшие месяцы.",
      financialCast: "💰 Ваши денежные коды раскрыты! Используйте эти знания для привлечения изобилия.",
      mistakesIncarnation: "🕰️ Узнайте об уроках вашего прошлого воплощения и кармических задачах.",
      arcanumRealization: "✨ Ваш аркан самореализации раскрыт! Познайте свой истинный путь.",
      awakeningCodes: "✨ Три кода пробуждения открыты! Узнайте свою суть, страх и реализацию."
    };
    return texts[productType] || "✨ Ваш персональный расчёт готов!";
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

export const botManager = new BotManager();
export default botManager;
