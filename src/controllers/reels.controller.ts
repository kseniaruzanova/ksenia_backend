import { Request, Response } from 'express';
import Reel from '../models/reel.model';
import { catchAsync } from '../lib/catchAsync';
import { AuthRequest } from '../interfaces/authRequest';
import AISettings from '../models/aiSettings.model';
import videoGeneratorService from '../services/videoGenerator.service';
import imageGeneratorService from '../services/imageGenerator.service';
import path from 'path';
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
        imageAnimation: 'zoom-in',                                    // По умолчанию zoom-in
        transition: index < blocks.length - 1 ? 'fade' : 'none',     // Fade между блоками, последний без
        scrollingText: false,                                         // По умолчанию обычный текст
        audioUrl: undefined,
        order: index + 1
      };
    });

    reel.blocks = formattedBlocks;
    reel.status = 'blocks_created';
    await reel.save();

    console.log(`✅ Video blocks generated and saved for reel ${id}`);
    
    // Генерируем изображения для всех блоков асинхронно
    generateImagesAsync(reel).catch(error => {
      console.error(`❌ Error generating images for reel ${id}:`, error);
    });
    
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

    const systemPrompt = `Ты — креативный сценарист для коротких видео. Твоя задача — создать структурированный сценарий из 5 блоков по 10 секунд каждый.

ВАЖНО: Ответ должен быть СТРОГО в формате JSON массива, без дополнительного текста!

Формат ответа:
[
  {
    "voiceText": "Текст для озвучки голосом (что будет говорить диктор)",
    "displayText": "Короткий текст для отображения на экране",
    "duration": 10,
    "imagePrompts": [
      "Детальное описание первого изображения для генерации",
      "Детальное описание второго изображения для генерации",
      "Детальное описание третьего изображения для генерации",
      "Детальное описание четвертого изображения для генерации",
      "Детальное описание пятого изображения для генерации"
    ]
  },
  {
    "voiceText": "Текст для озвучки второго блока",
    "displayText": "Короткий текст на экране",
    "duration": 10,
    "imagePrompts": [
      "Детальное описание первого изображения для генерации",
      "Детальное описание второго изображения для генерации",
      "Детальное описание третьего изображения для генерации",
      "Детальное описание четвертого изображения для генерации",
      "Детальное описание пятого изображения для генерации"
    ]
  }
  ... (всего 5 блоков)
]

Требования:
- Ровно 5 блоков
- voiceText: текст для озвучки (естественная речь) ровно на 10 секунд
- displayText: 3-7 слов (ключевая мысль блока)
- duration: всегда 10 секунд
- imagePrompts: ровно 5 детальных промптов для генерации изображений через DALL-E
- Логичная последовательность от вступления к заключению
- Каждый блок должен быть законченной мыслью
- Промпты для изображений должны быть детальными и визуально привлекательными
- Изображения должны соответствовать теме блока и быть подходящими для вертикального формата (9:16)

Примеры хороших displayText:
- "Начни с малого"
- "3 простых шага"
- "Результат за неделю"
- "Главный секрет успеха"

Примеры хороших imagePrompts:
- "Современный минималистичный офис с большими окнами, естественное освещение, профессиональная атмосфера"
- "Красивый закат над городом, силуэты зданий, теплые цвета, вертикальная композиция"
- "Абстрактная композиция с градиентами синего и фиолетового, современный дизайн"

Отвечай ТОЛЬКО JSON массивом, без markdown форматирования, без текста до или после!`;

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

    // Запускаем генерацию видео асинхронно
    generateVideoAsync(reel).catch(error => {
      console.error(`❌ Error in async video generation for reel ${id}:`, error);
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

    // Всегда перегенерируем изображения при перегенерации видео
    if (Array.isArray(reel.blocks)) {
      reel.blocks = reel.blocks.map((b: any) => ({ ...b, images: [] }));
    }

    // Сбрасываем предыдущий url видео
    reel.videoUrl = undefined as any;

    // Инициализируем прогресс
    reel.status = 'video_generating';
    reel.generationProgress = {
      currentStep: 'Инициализация генерации видео',
      stepProgress: 0,
      totalProgress: 0,
      estimatedTimeRemaining: 180,
      logs: ['♻️ Запущена перегенерация видео...', forceTTS ? '🎙️ Пересоздаем озвучку' : '🎙️ Используем существующую озвучку'],
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

// Асинхронная генерация изображений
async function generateImagesAsync(reel: any) {
  try {
    console.log(`🎨 Generating images for reel ${reel._id}...`);
    console.log(`📊 Reel blocks count: ${reel.blocks?.length || 0}`);
    
    if (reel.blocks) {
      reel.blocks.forEach((block: any, index: number) => {
        console.log(`📝 Block ${index + 1}: imagePrompts = ${block.imagePrompts?.length || 0}`);
      });
    }
    
    // Используем imageGeneratorService для генерации изображений
    await imageGeneratorService.generateImagesForReel(reel);
    
    // Сохраняем обновленный рилс с изображениями
    await reel.save();
    
    console.log(`✅ Images generated successfully for reel ${reel._id}`);
    
  } catch (error) {
    console.error(`❌ Error generating images for reel ${reel._id}:`, error);
  }
}

// Асинхронная генерация видео
async function generateVideoAsync(reel: any) {
  try {
    console.log(`🎬 Generating video for reel ${reel._id}...`);
    
    // Сначала генерируем изображения, если их нет
    if (reel.blocks && reel.blocks.some((b: any) => !b.images || b.images.length === 0)) {
      console.log(`🎨 Generating missing images for reel ${reel._id}...`);
      await imageGeneratorService.generateImagesForReel(reel);
      await reel.save();
    }
    
    // Используем videoGeneratorService для генерации
    const videoPath = await videoGeneratorService.generateVideo(reel);
    
    // Обновляем рилс с URL видео
    reel.videoUrl = `/api/uploads/videos/${path.basename(videoPath)}`;
    reel.status = 'video_created';
    await reel.save();
    
    console.log(`✅ Video generated successfully for reel ${reel._id}: ${reel.videoUrl}`);
    
  } catch (error) {
    console.error(`❌ Error generating video for reel ${reel._id}:`, error);
    reel.status = 'blocks_created'; // Возвращаем к предыдущему статусу
    await reel.save();
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
