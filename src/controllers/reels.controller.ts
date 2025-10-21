import { Request, Response } from 'express';
import Reel from '../models/reel.model';
import { catchAsync } from '../lib/catchAsync';
import { AuthRequest } from '../interfaces/authRequest';
import AISettings from '../models/aiSettings.model';
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
