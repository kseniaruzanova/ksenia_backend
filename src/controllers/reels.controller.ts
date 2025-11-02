import { Request, Response } from 'express';
import Reel from '../models/reel.model';
import { catchAsync } from '../lib/catchAsync';
import { AuthRequest } from '../interfaces/authRequest';
import AISettings from '../models/aiSettings.model';
import videoGeneratorService from '../services/videoGenerator.service';
import imageGeneratorService from '../services/imageGenerator.service';
import queueService from '../services/queue.service';
import path from 'path';
import fs from 'fs';
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Вспомогательная функция для отправки запроса к AI
async function sendRequestToAI(
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
        if (proxySettings.username && proxySettings.password) {
          proxyUrl = `socks5://${proxySettings.username}:${proxySettings.password}@${proxySettings.ip}:${proxySettings.port}`;
        } else {
          proxyUrl = `socks5://${proxySettings.ip}:${proxySettings.port}`;
        }
        fetchOptions.agent = new SocksProxyAgent(proxyUrl);
      } else {
        const protocol = proxySettings.type.toLowerCase();
        if (proxySettings.username && proxySettings.password) {
          proxyUrl = `${protocol}://${proxySettings.username}:${proxySettings.password}@${proxySettings.ip}:${proxySettings.port}`;
        } else {
          proxyUrl = `${protocol}://${proxySettings.ip}:${proxySettings.port}`;
        }
        fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
      }
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

// Функция для генерации сценария с помощью ИИ
async function generateScenarioWithAI(prompt: string): Promise<string> {
  try {
    let settings = await AISettings.findOne();
    
    if (!settings) {
      settings = await AISettings.create({
        vsegptApiKey: process.env.VSE_GPT_API_KEY || ''
      });
    }

    const apiKey = settings.vsegptApiKey || process.env.VSE_GPT_API_KEY || '';
    
    if (!apiKey) {
      throw new Error('VseGPT API key not configured');
    }

    const proxySettings = settings.proxyEnabled ? {
      enabled: true,
      type: settings.proxyType || 'SOCKS5' as 'SOCKS5' | 'HTTP' | 'HTTPS',
      ip: settings.proxyIp || '',
      port: settings.proxyPort || 4145,
      username: settings.proxyUsername,
      password: settings.proxyPassword
    } : undefined;

    const systemPrompt = `Ты — креативный сценарист, специализирующийся на создании коротких видео для социальных сетей.

Твоя задача — на основе промпта пользователя создать детальный сценарий для короткого видео (рилса).

ВАЖНО: Используй форматирование Markdown для красивого вывода!

Структура сценария:

# 🎬 КОНЦЕПЦИЯ

**Основная идея:** [2-3 предложения о главной идее и месседже]

**Целевая аудитория:** [Кто смотрит это видео]

**Эмоциональный тон:** [Настроение видео]

**Длительность:** [15-60 секунд]

---

# 📹 ВИЗУАЛЬНЫЙ РЯД

## Кадр 1 (0-3 сек)
**Визуал:** [Детальное описание того, что видно на экране]

**Действие:** [Что происходит]

## Кадр 2 (3-7 сек)
**Визуал:** [Описание]

**Действие:** [Что происходит]

## Кадр 3 (7-10 сек)
**Визуал:** [Описание]

**Действие:** [Что происходит]

[Продолжи по необходимости...]

---

# 🎙️ ТЕКСТ И ОЗВУЧКА

**Голос за кадром:**
- [0-3 сек]: "Текст первой фразы"
- [3-7 сек]: "Текст второй фразы"
- [7-10 сек]: "Текст третьей фразы"

**Текстовые overlay:**
- "Ключевая фраза 1" (появляется в 2 сек)
- "Ключевая фраза 2" (появляется в 5 сек)

---

# 🎵 МУЗЫКА И ЗВУКИ

**Музыка:** [Описание стиля музыки, темп, настроение]

**Звуковые эффекты:**
- [Тайминг]: [Описание эффекта]
- [Тайминг]: [Описание эффекта]

---

# ✨ МОНТАЖ И ЭФФЕКТЫ

**Переходы:**
- [Между кадрами 1-2]: [Тип перехода]
- [Между кадрами 2-3]: [Тип перехода]

**Визуальные эффекты:**
- [Список эффектов с таймингом]

**Цветокоррекция:** [Общий стиль]

---

# 💡 ФИНАЛЬНЫЕ РЕКОМЕНДАЦИИ

- [Совет 1]
- [Совет 2]
- [Совет 3]

Пиши конкретно, детально и профессионально. Сценарий должен быть готов к производству.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const requestData = {
      model: 'openai/gpt-4o-mini',
      messages,
      temperature: 0.8,
      max_tokens: 2000
    };

    console.log(`🤖 Generating scenario with AI...`);
    
    const response = await sendRequestToAI(requestData, apiKey, 'vsegpt', proxySettings);
    
    const scenario = response?.choices?.[0]?.message?.content;
    
    if (!scenario) {
      throw new Error('No content in AI response');
    }

    console.log(`✅ Scenario generated successfully (${scenario.length} characters)`);
    
    return scenario.trim();
    
  } catch (error) {
    console.error('❌ Error generating scenario with AI:', error);
    throw error;
  }
}

// Получить все рилсы пользователя
export const getUserReels = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const reels = await Reel.find({ userId })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json(reels);
};

// Создать новый рилс
export const createReel = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;

  const { title, prompt } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!title || !prompt) {
    return res.status(400).json({ error: 'Title and prompt are required' });
  }

  const reel = await Reel.create({
    userId,
    title,
    prompt,
    status: 'draft',
  });

  res.status(201).json(reel);
};

// Получить конкретный рилс
export const getReel = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const reel = await Reel.findOne({ _id: id, userId }).lean();

  if (!reel) {
    return res.status(404).json({ error: 'Reel not found' });
  }

  res.status(200).json(reel);
};

// Обновить рилс
export const updateReel = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;
  const { id } = req.params;
  const { title, prompt, scenario, videoUrl, status } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (prompt !== undefined) updates.prompt = prompt;
  if (scenario !== undefined) updates.scenario = scenario;
  if (videoUrl !== undefined) updates.videoUrl = videoUrl;
  if (status !== undefined) updates.status = status;

  const reel = await Reel.findOneAndUpdate(
    { _id: id, userId },
    updates,
    { new: true, runValidators: true }
  );

  if (!reel) {
    return res.status(404).json({ error: 'Reel not found' });
  }

  res.status(200).json(reel);
};

// Удалить рилс
export const deleteReel = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;
  
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const reel = await Reel.findOneAndDelete({ _id: id, userId });

  if (!reel) {
    return res.status(404).json({ error: 'Reel not found' });
  }

  res.status(200).json({ message: 'Reel deleted successfully' });
};

// Сгенерировать блоки для видео с помощью ИИ
export const generateVideoBlocks = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const reel = await Reel.findOne({ _id: id, userId });

  if (!reel) {
    return res.status(404).json({ error: 'Reel not found' });
  }

  if (!reel.prompt) {
    return res.status(400).json({ error: 'Prompt is required to generate video blocks' });
  }

  try {
    console.log(`🎬 Generating video blocks for reel ${id}...`);
    
    // Генерируем структурированный сценарий для 5 блоков
    const blocksData = await generateVideoBlocksWithAI(reel.prompt);
    
    // Парсим JSON ответ от ИИ
    const blocks = JSON.parse(blocksData);
    
    console.log(`📋 Parsed blocks:`, JSON.stringify(blocks, null, 2));
    
    // Добавляем ID и order к каждому блоку с дефолтными значениями для анимаций
    const formattedBlocks = blocks.map((block: any, index: number) => {
      // Fallback промпты для изображений, если ИИ их не сгенерировал
      const fallbackImagePrompts = [
        `Современная абстрактная композиция с градиентами для блока ${index + 1}`,
        `Минималистичный дизайн с геометрическими формами для блока ${index + 1}`,
        `Креативная иллюстрация с яркими цветами для блока ${index + 1}`,
        `Профессиональная фотография с естественным освещением для блока ${index + 1}`,
        `Художественная композиция с текстурами для блока ${index + 1}`
      ];
      
      const finalImagePrompts = block.imagePrompts && block.imagePrompts.length > 0 ? block.imagePrompts : fallbackImagePrompts;
      
      if (!block.imagePrompts || block.imagePrompts.length === 0) {
        console.log(`⚠️ Block ${index + 1}: Using fallback image prompts`);
      } else {
        console.log(`✅ Block ${index + 1}: Using AI-generated image prompts`);
      }
      
      return {
        id: `block_${Date.now()}_${index}`,
        text: block.voiceText || block.text || '',
        displayText: block.displayText || block.text || '',
        duration: block.duration || 10,
        images: [],
        imagePrompts: finalImagePrompts,
        imageAnimation: 'zoom-in',                                    // По умолчанию zoom-in (zoom-in или swipe)
        transition: 'fade',                                           // Всегда fade между блоками
        scrollingText: false,                                         // По умолчанию обычный текст
        audioUrl: undefined,
        audioType: 'ai',                                              // По умолчанию AI озвучка
        order: index + 1
      };
    });

    reel.blocks = formattedBlocks;
    reel.status = 'blocks_created';
    await reel.save();

    console.log(`✅ Video blocks generated and saved for reel ${id}`);
    
    res.status(200).json(reel);
  } catch (error: any) {
    console.error(`❌ Error generating video blocks for reel ${id}:`, error);
    res.status(500).json({ 
      error: 'Failed to generate video blocks', 
      details: error.message 
    });
  }
};

// Функция для генерации блоков видео с помощью ИИ
async function generateVideoBlocksWithAI(prompt: string): Promise<string> {
  try {
    let settings = await AISettings.findOne();
    
    if (!settings) {
      settings = await AISettings.create({
        vsegptApiKey: process.env.VSE_GPT_API_KEY || ''
      });
    }

    const apiKey = settings.vsegptApiKey || process.env.VSE_GPT_API_KEY || '';
    
    if (!apiKey) {
      throw new Error('VseGPT API key not configured');
    }

    const proxySettings = settings.proxyEnabled ? {
      enabled: true,
      type: settings.proxyType || 'SOCKS5' as 'SOCKS5' | 'HTTP' | 'HTTPS',
      ip: settings.proxyIp || '',
      port: settings.proxyPort || 4145,
      username: settings.proxyUsername,
      password: settings.proxyPassword
    } : undefined;

    const systemPrompt = `Ты — креативный сценарист коротких, вирусных видео в стиле Reels/TikTok. Твоя цель — создать цепляющий сценарий из 5 блоков по 10 секунд каждый, где каждый блок — динамичный, эмоциональный и легко воспринимается на слух.
⚡️Формат ответа:
[
{
"voiceText": "Текст для озвучки голосом (естественная, энергичная речь с эмоциями, акцентами и живыми фразами, как будто диктор говорит прямо в камеру)",
"displayText": "Короткий, цепляющий текст для экрана (3–7 слов)",
"duration": 10,
"imagePrompts": [
"Детальное, визуально мощное описание первого изображения (вертикальный формат 9:16)",
"Детальное, визуально мощное описание второго изображения",
"Детальное, визуально мощное описание третьего изображения",
"Детальное, визуально мощное описание четвертого изображения",
"Детальное, визуально мощное описание пятого изображения"
]
},
... (всего 5 блоков)
]

🔥 Правила:

* Ровно 5 блоков.
* Каждый voiceText — естественная, динамичная речь, длиной около 10 секунд (примерно 25–30 секунд на весь ролик).
* Добавляй эмоции: удивление, мотивацию, вовлеченность. Можно использовать риторические вопросы, короткие фразы, паузы, обрывы, чтобы звучало живо.
* Каждый блок — законченная, понятная мысль, логично связанная с предыдущим.
* displayText — короткая, броская фраза, которая поддерживает тему блока (3–7 слов).
* imagePrompts — ровно 5 детальных, ярких описаний сцен, подходящих для вертикального видео (9:16), в современном визуальном стиле.
* Изображения должны усиливать смысл voiceText: эмоции, движения, динамику, контраст.
* Тема должна развиваться от интригующего вступления к вдохновляющему финалу.

💡 Примеры стиля voiceText:

* "Ты когда-нибудь задумывался, почему у одних всё получается, а другие топчутся на месте? Сейчас расскажу секрет."
* "Вот в чём фишка — не нужно ждать идеального момента. Просто начни. Прямо сегодня."
* "Эта привычка изменила мою жизнь. Серьёзно. И она настолько простая, что ты офигеешь."

📱 Примеры хороших displayText:

* "Начни прямо сейчас"
* "3 шага к цели"
* "Твой знак действовать"
* "Секрет продуктивности"
* "Почему ты стоишь на месте"

🎨 Примеры хороших imagePrompts:

* "Динамичный городской пейзаж на закате, движение машин, мягкие тёплые тона, вертикальная композиция"
* "Человек смотрит в окно офиса, солнечные лучи, отражение города в стекле, современный стиль"
* "Крупный план эмоций — удивление, вдохновение, решимость, реалистичное освещение"
* "Абстрактная энергия в движении, неоновые цвета, градиенты синего и пурпурного"
* "Мотивирующая сцена старта — человек делает первый шаг на рассвете, мягкий свет, реализм"

Отвечай СТРОГО JSON массивом, без markdown, текста до или после!
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const requestData = {
      model: 'openai/gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1500
    };

    console.log(`🤖 Generating video blocks with AI...`);
    
    const response = await sendRequestToAI(requestData, apiKey, 'vsegpt', proxySettings);
    
    let blocksData = response?.choices?.[0]?.message?.content;
    
    if (!blocksData) {
      throw new Error('No content in AI response');
    }

    // Очищаем ответ от возможного markdown форматирования
    blocksData = blocksData.trim();
    blocksData = blocksData.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    blocksData = blocksData.trim();

    // Проверяем что это валидный JSON
    JSON.parse(blocksData);

    console.log(`✅ Video blocks generated successfully`);
    
    return blocksData;
    
  } catch (error) {
    console.error('❌ Error generating video blocks with AI:', error);
    throw error;
  }
}

// Обновить блоки видео
export const updateVideoBlocks = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;
  const { id } = req.params;
  const { blocks, backgroundMusic, audioSettings } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const reel = await Reel.findOne({ _id: id, userId });

  if (!reel) {
    return res.status(404).json({ error: 'Reel not found' });
  }

  try {
    if (blocks !== undefined) {
      reel.blocks = blocks;
    }
    if (backgroundMusic !== undefined) {
      reel.backgroundMusic = backgroundMusic;
    }
    if (audioSettings !== undefined) {
      reel.audioSettings = audioSettings;
    }

    await reel.save();

    console.log(`✅ Video blocks updated for reel ${id}`);
    
    res.status(200).json(reel);
  } catch (error: any) {
    console.error(`❌ Error updating video blocks for reel ${id}:`, error);
    res.status(500).json({ 
      error: 'Failed to update video blocks', 
      details: error.message 
    });
  }
};

// Сгенерировать финальное видео
export const generateFinalVideo = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const reel = await Reel.findOne({ _id: id, userId });

  if (!reel) {
    return res.status(404).json({ error: 'Reel not found' });
  }

  if (!reel.blocks || reel.blocks.length === 0) {
    return res.status(400).json({ error: 'No video blocks found. Please create blocks first.' });
  }

  try {
    console.log(`🎬 Starting video generation for reel ${id}...`);
    
    // Инициализируем прогресс генерации
    reel.status = 'video_generating';
    reel.generationProgress = {
      currentStep: 'Инициализация генерации видео',
      stepProgress: 0,
      totalProgress: 0,
      estimatedTimeRemaining: 180, // 3 минуты по умолчанию
      logs: ['🎬 Начинаем генерацию видео...'],
      error: undefined
    };
    await reel.save();

    // Добавляем генерацию видео в очередь
    videoGeneratorService.queueVideoGeneration(reel, 1).catch(error => {
      console.error(`❌ Error queuing video generation for reel ${id}:`, error);
      // Обновляем статус при ошибке
      reel.status = 'blocks_created';
      reel.generationProgress = {
        currentStep: 'Ошибка добавления в очередь',
        stepProgress: 0,
        totalProgress: 0,
        estimatedTimeRemaining: 0,
        logs: ['❌ Ошибка при добавлении задачи в очередь'],
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
      reel.save().catch(saveError => {
        console.error(`❌ Error saving reel status after queue failure:`, saveError);
      });
    });

    // Сразу возвращаем ответ, что генерация началась
    res.status(202).json({ 
      message: 'Video generation started',
      reelId: reel._id,
      estimatedTime: '2-5 minutes',
      progress: reel.generationProgress
    });
    
  } catch (error: any) {
    console.error(`❌ Error starting video generation for reel ${id}:`, error);
    res.status(500).json({ 
      error: 'Failed to start video generation', 
      details: error.message 
    });
  }
};

// Получить прогресс генерации видео
export const getVideoGenerationProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.customerId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reel = await Reel.findOne({ _id: id, userId });
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found' });
    }

    res.status(200).json({
      status: reel.status,
      progress: reel.generationProgress || {
        currentStep: 'Не начато',
        stepProgress: 0,
        totalProgress: 0,
        logs: []
      }
    });

  } catch (error: any) {
    console.error('Error getting video generation progress:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Перегенерировать финальное видео (с опцией пересоздать TTS)
export const regenerateFinalVideo = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;
  const { id } = req.params;
  const { forceTTS } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const reel = await Reel.findOne({ _id: id, userId });

  if (!reel) {
    return res.status(404).json({ error: 'Reel not found' });
  }

  if (!reel.blocks || reel.blocks.length === 0) {
    return res.status(400).json({ error: 'No video blocks found. Please create blocks first.' });
  }

  try {
    console.log(`♻️ Regenerating video for reel ${id}... forceTTS=${!!forceTTS}`);

    // Опционально очищаем озвучку, чтобы пересинтезировать
    if (forceTTS && Array.isArray(reel.blocks)) {
      reel.blocks = reel.blocks.map((b: any) => ({ ...b, audioUrl: undefined }));
    }

    // НЕ перегенерируем изображения при перегенерации видео - используем существующие
    // if (Array.isArray(reel.blocks)) {
    //   reel.blocks = reel.blocks.map((b: any) => ({ ...b, images: [] }));
    // }

    // Сбрасываем предыдущий url видео
    reel.videoUrl = undefined as any;

    // Инициализируем прогресс
    reel.status = 'video_generating';
    reel.generationProgress = {
      currentStep: 'Инициализация генерации видео',
      stepProgress: 0,
      totalProgress: 0,
      estimatedTimeRemaining: 180,
      logs: [
        '♻️ Запущена перегенерация видео...', 
        forceTTS ? '🎙️ Пересоздаем озвучку' : '🎙️ Используем существующую озвучку',
        '🖼️ Используем существующие изображения'
      ],
      error: undefined
    };
    await reel.save();

    // Запускаем генерацию видео асинхронно
    generateVideoAsync(reel).catch(error => {
      console.error(`❌ Error in async video regeneration for reel ${id}:`, error);
    });

    return res.status(202).json({
      message: 'Video regeneration started',
      reelId: reel._id,
      estimatedTime: '2-5 minutes',
      progress: reel.generationProgress
    });
  } catch (error: any) {
    console.error(`❌ Error starting video regeneration for reel ${id}:`, error);
    return res.status(500).json({ error: 'Failed to start video regeneration', details: error.message });
  }
};

// Асинхронная генерация изображений с улучшенной обработкой ошибок
async function generateImagesAsync(reel: any) {
  try {
    console.log(`🎨 Starting parallel image generation for reel ${reel._id}...`);
    console.log(`📊 Reel blocks count: ${reel.blocks?.length || 0}`);
    
    if (reel.blocks) {
      reel.blocks.forEach((block: any, index: number) => {
        console.log(`📝 Block ${index + 1}: imagePrompts = ${block.imagePrompts?.length || 0}`);
      });
    }
    
    // Обновляем статус на генерацию изображений
    reel.status = 'generating_images';
    await reel.save();
    
    // Используем imageGeneratorService для параллельной генерации изображений
    await imageGeneratorService.generateImagesForReel(reel);
    
    // Сохраняем обновленный рилс с изображениями
    await reel.save();
    
    console.log(`✅ Images generated successfully for reel ${reel._id}`);
    
  } catch (error) {
    console.error(`❌ Error generating images for reel ${reel._id}:`, error);
    
    // Обновляем статус при ошибке
    try {
      reel.status = 'blocks_created'; // Возвращаем к предыдущему статусу
      await reel.save();
    } catch (saveError) {
      console.error(`❌ Error saving reel status after image generation failure:`, saveError);
    }
  }
}

// Асинхронная генерация видео с улучшенной обработкой ошибок
async function generateVideoAsync(reel: any) {
  try {
    console.log(`🎬 Starting parallel video generation for reel ${reel._id}...`);
    
    // Обновляем статус на генерацию видео
    reel.status = 'video_generating';
    await reel.save();
    
    // Используем videoGeneratorService для параллельной генерации
    const videoPath = await videoGeneratorService.generateVideo(reel);
    
    // Обновляем рилс с URL видео
    reel.videoUrl = `/api/uploads/videos/${path.basename(videoPath)}`;
    reel.status = 'video_created';
    reel.generationProgress = {
      currentStep: 'Видео успешно создано',
      stepProgress: 100,
      totalProgress: 100,
      estimatedTimeRemaining: 0,
      logs: ['✅ Видео успешно создано!'],
      error: undefined
    };
    await reel.save();
    
    console.log(`✅ Video generated successfully for reel ${reel._id}: ${reel.videoUrl}`);
    
  } catch (error) {
    console.error(`❌ Error generating video for reel ${reel._id}:`, error);
    
    // Обновляем статус и прогресс при ошибке
    try {
      reel.status = 'blocks_created'; // Возвращаем к предыдущему статусу
      reel.generationProgress = {
        currentStep: 'Ошибка генерации видео',
        stepProgress: 0,
        totalProgress: 0,
        estimatedTimeRemaining: 0,
        logs: ['❌ Произошла ошибка при генерации видео'],
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
      await reel.save();
    } catch (saveError) {
      console.error(`❌ Error saving reel status after video generation failure:`, saveError);
    }
  }
}

// Перегенерировать изображение по промпту
export const regenerateImage = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;
  const { prompt, blockIndex, promptIndex } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    console.log(`🎨 Regenerating image for prompt: "${prompt.substring(0, 50)}..."`);
    
    // Генерируем одно изображение
    const images = await imageGeneratorService.generateImagesForBlock([prompt], blockIndex || 0, `temp_${Date.now()}`);
    
    if (images.length > 0) {
      res.status(200).json({ 
        imageUrl: images[0],
        message: 'Image regenerated successfully'
      });
    } else {
      res.status(500).json({ error: 'Failed to generate image' });
    }
    
  } catch (error: any) {
    console.error(`❌ Error regenerating image:`, error);
    res.status(500).json({ 
      error: 'Failed to regenerate image', 
      details: error.message 
    });
  }
};

// Сгенерировать сценарий для рилса с помощью ИИ
export const generateScenario = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.customerId;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const reel = await Reel.findOne({ _id: id, userId });

  if (!reel) {
    return res.status(404).json({ error: 'Reel not found' });
  }

  if (!reel.prompt) {
    return res.status(400).json({ error: 'Prompt is required to generate scenario' });
  }

  try {
    console.log(`🎬 Generating scenario for reel ${id}...`);
    
    const scenario = await generateScenarioWithAI(reel.prompt);
    
    reel.scenario = scenario;
    reel.status = 'scenario_generated';
    await reel.save();

    console.log(`✅ Scenario generated and saved for reel ${id}`);
    
    res.status(200).json(reel);
  } catch (error: any) {
    console.error(`❌ Error generating scenario for reel ${id}:`, error);
    res.status(500).json({ 
      error: 'Failed to generate scenario', 
      details: error.message 
    });
  }
};

// Получить статистику очередей генерации
export const getQueueStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = queueService.getStats();
    res.status(200).json(stats);
  } catch (error: any) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Получить статистику пула потоков
export const getThreadPoolStats = async (req: AuthRequest, res: Response) => {
  try {
    const threadPoolService = require('../services/threadPool.service').default;
    const stats = threadPoolService.getStats();
    res.status(200).json(stats);
  } catch (error: any) {
    console.error('Error getting thread pool stats:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Отменить задачу генерации
export const cancelGenerationTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.customerId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cancelled = queueService.cancelTask(taskId);
    
    if (cancelled) {
      res.status(200).json({ message: 'Task cancelled successfully' });
    } else {
      res.status(404).json({ error: 'Task not found or already completed' });
    }
  } catch (error: any) {
    console.error('Error cancelling task:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Генерировать изображения для конкретного блока
export const generateBlockImages = async (req: AuthRequest, res: Response) => {
  try {
    const { id, blockIndex } = req.params;
    const { imageCount } = req.body;
    const userId = req.user?.customerId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reel = await Reel.findOne({ _id: id, userId });
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found' });
    }

    const blockIdx = parseInt(blockIndex);
    if (!reel.blocks || blockIdx < 0 || blockIdx >= reel.blocks.length) {
      return res.status(400).json({ error: 'Invalid block index' });
    }

    const block = reel.blocks[blockIdx];
    if (!block.imagePrompts || block.imagePrompts.length === 0) {
      return res.status(400).json({ error: 'No image prompts found for this block' });
    }

    // Проверяем, не генерируются ли уже изображения для этого блока
    if (block.imageGenerationStatus === 'generating') {
      return res.status(400).json({ error: 'Images are already being generated for this block' });
    }

    // Обновляем количество изображений если указано
    const targetImageCount = imageCount || block.imagePrompts.length;
    if (targetImageCount !== block.imagePrompts.length) {
      // Обрезаем или дублируем промпты до нужного количества
      const adjustedPrompts = [];
      for (let i = 0; i < targetImageCount; i++) {
        adjustedPrompts.push(block.imagePrompts[i % block.imagePrompts.length]);
      }
      block.imagePrompts = adjustedPrompts;
    }

    // Устанавливаем статус генерации
    block.imageGenerationStatus = 'generating';
    block.imageGenerationProgress = 0;
    await reel.save();

    console.log(`🎨 Starting image generation for block ${blockIdx} of reel ${id} (${targetImageCount} images)`);
    console.log(`🔍 Reel ID for generation: ${reel._id} (type: ${typeof reel._id})`);

    // Генерируем изображения в фоне
    imageGeneratorService.generateImagesForBlock(
      block.imagePrompts, 
      blockIdx, 
      String(reel._id),
      targetImageCount
    ).then(async (images) => {
      // Используем findByIdAndUpdate для безопасного обновления
      await Reel.findByIdAndUpdate(
        reel._id,
        {
          $set: {
            [`blocks.${blockIdx}.images`]: images,
            [`blocks.${blockIdx}.imageGenerationStatus`]: 'completed',
            [`blocks.${blockIdx}.imageGenerationProgress`]: 100
          }
        },
        { new: true }
      );
      
      console.log(`✅ Image generation completed for block ${blockIdx}: ${images.length} images`);
    }).catch(async (error) => {
      console.error(`❌ Image generation failed for block ${blockIdx}:`, error);
      // Используем findByIdAndUpdate для безопасного обновления ошибки
      await Reel.findByIdAndUpdate(
        reel._id,
        {
          $set: {
            [`blocks.${blockIdx}.imageGenerationStatus`]: 'failed',
            [`blocks.${blockIdx}.imageGenerationError`]: error.message
          }
        },
        { new: true }
      );
    });

    res.status(202).json({ 
      message: 'Image generation started',
      blockIndex: blockIdx,
      targetImageCount,
      status: 'generating'
    });

  } catch (error: any) {
    console.error('Error generating block images:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Обновление промптов блока
export const updateBlockPrompts = async (req: AuthRequest, res: Response) => {
  try {
    const { id, blockIndex } = req.params;
    const { imagePrompts } = req.body;
    const userId = req.user?.customerId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reel = await Reel.findOne({ _id: id, userId });
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found' });
    }

    const blockIdx = parseInt(blockIndex);
    if (!reel.blocks || blockIdx < 0 || blockIdx >= reel.blocks.length) {
      return res.status(400).json({ error: 'Invalid block index' });
    }

    if (!imagePrompts || !Array.isArray(imagePrompts)) {
      return res.status(400).json({ error: 'imagePrompts must be an array' });
    }

    // Обновляем промпты блока
    await Reel.findByIdAndUpdate(
      reel._id,
      {
        $set: {
          [`blocks.${blockIdx}.imagePrompts`]: imagePrompts
        }
      },
      { new: true }
    );

    console.log(`✅ Updated prompts for block ${blockIdx} of reel ${id}: ${imagePrompts.length} prompts`);

    res.status(200).json({ 
      message: 'Block prompts updated successfully',
      blockIndex: blockIdx,
      imagePrompts
    });

  } catch (error: any) {
    console.error('Error updating block prompts:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Обновление всего блока
export const updateBlock = async (req: AuthRequest, res: Response) => {
  try {
    const { id, blockIndex } = req.params;
    const { blockData } = req.body;
    const userId = req.user?.customerId;

    console.log(`🔍 updateBlock called with id: ${id}, blockIndex: ${blockIndex}, userId: ${userId}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Валидация ID
    if (!id || typeof id !== 'string' || id.length !== 24) {
      console.error(`❌ Invalid reel ID: ${id}`);
      return res.status(400).json({ error: 'Invalid reel ID format' });
    }

    const reel = await Reel.findOne({ _id: id, userId });
    if (!reel) {
      console.error(`❌ Reel not found: ${id} for user: ${userId}`);
      return res.status(404).json({ error: 'Reel not found' });
    }

    console.log(`✅ Found reel: ${reel._id}`);

    const blockIdx = parseInt(blockIndex);
    if (isNaN(blockIdx) || !reel.blocks || blockIdx < 0 || blockIdx >= reel.blocks.length) {
      console.error(`❌ Invalid block index: ${blockIndex}, blocks length: ${reel.blocks?.length || 0}`);
      console.error(`❌ Available block indices: 0-${(reel.blocks?.length || 1) - 1}`);
      return res.status(400).json({ error: 'Invalid block index' });
    }

    console.log(`✅ Block index ${blockIdx} is valid. Block exists:`, !!reel.blocks[blockIdx]);
    console.log(`🔍 Block ${blockIdx} content:`, reel.blocks[blockIdx]);

    if (!blockData) {
      return res.status(400).json({ error: 'blockData is required' });
    }

    // Обновляем данные блока
    const updateFields: any = {};
    Object.keys(blockData).forEach(key => {
      updateFields[`blocks.${blockIdx}.${key}`] = blockData[key];
    });

    console.log(`🔄 Updating block ${blockIdx} with fields:`, Object.keys(updateFields));

    const updateResult = await Reel.findByIdAndUpdate(
      reel._id,
      { $set: updateFields },
      { new: true }
    );

    console.log(`✅ Update result:`, updateResult ? 'Success' : 'Failed');
    console.log(`🔍 Updated block ${blockIdx}:`, updateResult?.blocks?.[blockIdx]);

    console.log(`✅ Updated block ${blockIdx} of reel ${id}:`, Object.keys(blockData));

    res.status(200).json({ 
      message: 'Block updated successfully',
      blockIndex: blockIdx,
      updatedFields: Object.keys(blockData)
    });

  } catch (error: any) {
    console.error('Error updating block:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Загрузить аудио файл для блока
export const uploadBlockAudio = async (req: AuthRequest, res: Response) => {
  try {
    const { id, blockIndex } = req.params;
    const userId = req.user?.customerId;

    console.log(`🎵 Starting audio upload for reel ${id}, block ${blockIndex}, user ${userId}`);

    if (!userId) {
      console.error('❌ Unauthorized: userId is missing');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!id || typeof id !== 'string' || id.length !== 24) {
      console.error(`❌ Invalid reel ID format: ${id}`);
      return res.status(400).json({ error: 'Invalid reel ID format' });
    }

    const reel = await Reel.findOne({ _id: id, userId });
    if (!reel) {
      console.error(`❌ Reel not found: ${id} for user ${userId}`);
      return res.status(404).json({ error: 'Reel not found' });
    }

    const blockIdx = parseInt(blockIndex);
    if (isNaN(blockIdx) || !reel.blocks || blockIdx < 0 || blockIdx >= reel.blocks.length) {
      console.error(`❌ Invalid block index: ${blockIndex}, blocks length: ${reel.blocks?.length || 0}`);
      return res.status(400).json({ error: 'Invalid block index' });
    }

    // Проверяем наличие файла
    if (!req.file) {
      console.error('❌ No audio file in request');
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const audioFile = req.file;
    console.log(`📦 Audio file received:`, {
      originalname: audioFile.originalname,
      mimetype: audioFile.mimetype,
      size: audioFile.size,
      hasBuffer: !!audioFile.buffer,
      bufferLength: audioFile.buffer?.length || 0
    });

    if (!audioFile.buffer) {
      console.error('❌ Audio file buffer is missing');
      return res.status(400).json({ error: 'Invalid audio file' });
    }

    // Проверяем размер файла (максимум 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (audioFile.buffer.length > maxSize) {
      console.error(`❌ Audio file too large: ${audioFile.buffer.length} bytes (max: ${maxSize})`);
      return res.status(400).json({ error: 'Audio file is too large. Maximum size is 20MB' });
    }

    // Проверяем формат файла
    const allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm'];
    if (!allowedMimeTypes.includes(audioFile.mimetype)) {
      console.error(`❌ Invalid audio file format: ${audioFile.mimetype}`);
      return res.status(400).json({ error: 'Invalid audio file format. Allowed formats: MP3, WAV, M4A, OGG, WEBM' });
    }

    // Создаем директорию для аудио если её нет
    const audioDir = path.join(process.cwd(), 'uploads', 'audio');
    console.log(`📁 Audio directory: ${audioDir}`);
    
    if (!fs.existsSync(audioDir)) {
      console.log(`📁 Creating audio directory: ${audioDir}`);
      try {
        fs.mkdirSync(audioDir, { recursive: true });
        console.log(`✅ Audio directory created`);
      } catch (dirError: any) {
        console.error(`❌ Failed to create audio directory:`, dirError);
        return res.status(500).json({ error: `Failed to create audio directory: ${dirError.message}` });
      }
    }

    // Проверяем права на запись
    try {
      fs.accessSync(audioDir, fs.constants.W_OK);
    } catch (accessError: any) {
      console.error(`❌ No write permission for audio directory:`, accessError);
      return res.status(500).json({ error: `No write permission for audio directory: ${accessError.message}` });
    }

    // Генерируем уникальное имя файла
    const fileExtension = audioFile.originalname.split('.').pop() || 'mp3';
    const uniqueFileName = `audio_${id}_block${blockIdx}_${Date.now()}.${fileExtension}`;
    const filePath = path.join(audioDir, uniqueFileName);
    
    console.log(`💾 Saving audio file to: ${filePath} (${(audioFile.buffer.length / 1024).toFixed(2)} KB)`);

    // Сохраняем файл
    try {
      fs.writeFileSync(filePath, audioFile.buffer);
      console.log(`✅ File written successfully`);
    } catch (writeError: any) {
      console.error(`❌ Failed to write audio file:`, writeError);
      return res.status(500).json({ error: `Failed to save audio file: ${writeError.message}` });
    }

    // Проверяем, что файл действительно сохранен
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File was not saved: ${filePath}`);
      return res.status(500).json({ error: 'File was not saved on disk' });
    }

    const stats = fs.statSync(filePath);
    console.log(`✅ File verified: ${filePath} (${(stats.size / 1024).toFixed(2)} KB)`);
    
    if (stats.size === 0) {
      console.error(`❌ Saved file is empty`);
      fs.unlinkSync(filePath); // Удаляем пустой файл
      return res.status(500).json({ error: 'Saved file is empty' });
    }

    // Формируем URL
    const audioUrl = `/api/uploads/audio/${uniqueFileName}`;
    console.log(`🔗 Audio URL: ${audioUrl}`);

    // Удаляем старое аудио если оно было загружено пользователем
    const oldBlock = reel.blocks[blockIdx];
    if (oldBlock?.uploadedAudioUrl) {
      const oldAudioPath = path.join(audioDir, path.basename(oldBlock.uploadedAudioUrl.replace('/api/uploads/audio/', '')));
      if (fs.existsSync(oldAudioPath)) {
        try {
          fs.unlinkSync(oldAudioPath);
          console.log(`🗑️ Old audio file deleted: ${oldAudioPath}`);
        } catch (unlinkError: any) {
          console.warn(`⚠️ Failed to delete old audio file:`, unlinkError);
          // Не критично, продолжаем
        }
      }
    }

    // Обновляем блок
    try {
      await Reel.findByIdAndUpdate(
        reel._id,
        {
          $set: {
            [`blocks.${blockIdx}.uploadedAudioUrl`]: audioUrl,
            [`blocks.${blockIdx}.audioType`]: 'user'
          }
        },
        { new: true }
      );
      console.log(`✅ Database updated with audio URL`);
    } catch (dbError: any) {
      console.error(`❌ Failed to update database:`, dbError);
      // Удаляем файл, если не удалось сохранить в БД
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError: any) {
        console.error(`❌ Failed to cleanup file after DB error:`, cleanupError);
      }
      return res.status(500).json({ error: `Failed to update database: ${dbError.message}` });
    }

    console.log(`✅ Audio uploaded successfully for block ${blockIdx} of reel ${id}: ${audioUrl}`);

    res.status(200).json({
      message: 'Audio uploaded successfully',
      audioUrl,
      blockIndex: blockIdx
    });

  } catch (error: any) {
    console.error('❌ Error uploading block audio:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
