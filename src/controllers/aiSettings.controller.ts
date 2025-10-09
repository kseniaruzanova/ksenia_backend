import { Request, Response } from "express";
import AISettings from "../models/aiSettings.model";
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Получение глобальных настроек AI
export const getAISettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await AISettings.findOne();
    
    // Если настроек нет, создаем дефолтные
    if (!settings) {
      settings = await AISettings.create({
        vsegptApiKey: process.env.VSE_GPT_API_KEY || ''
      });
    }

    res.status(200).json({
      vsegptApiKey: settings.vsegptApiKey || '',
      openaiApiKey: settings.openaiApiKey || '',
      proxyEnabled: settings.proxyEnabled || false,
      proxyType: settings.proxyType || 'SOCKS5',
      proxyIp: settings.proxyIp || '',
      proxyPort: settings.proxyPort || 4145,
      proxyUsername: settings.proxyUsername || '',
      proxyPassword: settings.proxyPassword || ''
    });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    res.status(500).json({ message: "Error fetching AI settings", error });
  }
};

// Обновление глобальных настроек AI
export const updateAISettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      vsegptApiKey, 
      openaiApiKey, 
      proxyEnabled,
      proxyType,
      proxyIp,
      proxyPort,
      proxyUsername,
      proxyPassword
    } = req.body;

    let settings = await AISettings.findOne();
    
    if (!settings) {
      // Создаем новые настройки
      settings = await AISettings.create({
        vsegptApiKey: vsegptApiKey || process.env.VSE_GPT_API_KEY || '',
        openaiApiKey: openaiApiKey || '',
        proxyEnabled: proxyEnabled || false,
        proxyType: proxyType || 'SOCKS5',
        proxyIp: proxyIp || '',
        proxyPort: proxyPort || 4145,
        proxyUsername: proxyUsername || '',
        proxyPassword: proxyPassword || ''
      });
    } else {
      // Обновляем существующие настройки
      if (vsegptApiKey !== undefined) settings.vsegptApiKey = vsegptApiKey;
      if (openaiApiKey !== undefined) settings.openaiApiKey = openaiApiKey;
      if (proxyEnabled !== undefined) settings.proxyEnabled = proxyEnabled;
      if (proxyType !== undefined) settings.proxyType = proxyType;
      if (proxyIp !== undefined) settings.proxyIp = proxyIp;
      if (proxyPort !== undefined) settings.proxyPort = proxyPort;
      if (proxyUsername !== undefined) settings.proxyUsername = proxyUsername;
      if (proxyPassword !== undefined) settings.proxyPassword = proxyPassword;
      
      await settings.save();
    }

    res.status(200).json({
      message: "AI settings updated successfully",
      settings: {
        vsegptApiKey: settings.vsegptApiKey,
        openaiApiKey: settings.openaiApiKey,
        proxyEnabled: settings.proxyEnabled,
        proxyType: settings.proxyType,
        proxyIp: settings.proxyIp,
        proxyPort: settings.proxyPort,
        proxyUsername: settings.proxyUsername,
        proxyPassword: settings.proxyPassword
      }
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    res.status(500).json({ message: "Error updating AI settings", error });
  }
};

// Тест подключения через прокси к OpenAI
export const testProxyConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await AISettings.findOne();
    
    if (!settings) {
      res.status(404).json({ message: "AI settings not found. Please configure settings first." });
      return;
    }

    if (!settings.openaiApiKey) {
      res.status(400).json({ message: "OpenAI API key not configured" });
      return;
    }

    console.log(`🧪 Testing OpenAI connection with proxy...`);
    console.log(`Proxy enabled: ${settings.proxyEnabled}`);
    console.log(`Proxy type: ${settings.proxyType}`);
    console.log(`Proxy: ${settings.proxyIp}:${settings.proxyPort}`);

    const url = 'https://api.openai.com/v1/models';
    
    const fetchOptions: any = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.openaiApiKey}`
      }
    };

    // Настраиваем прокси
    if (settings.proxyEnabled && settings.proxyIp && settings.proxyPort) {
      let proxyUrl: string;
      
      if (settings.proxyType === 'SOCKS5') {
        if (settings.proxyUsername && settings.proxyPassword) {
          proxyUrl = `socks5://${settings.proxyUsername}:${settings.proxyPassword}@${settings.proxyIp}:${settings.proxyPort}`;
        } else {
          proxyUrl = `socks5://${settings.proxyIp}:${settings.proxyPort}`;
        }
        fetchOptions.agent = new SocksProxyAgent(proxyUrl);
        console.log(`🌐 Using SOCKS5 proxy: ${settings.proxyIp}:${settings.proxyPort}`);
      } else {
        const protocol = settings.proxyType?.toLowerCase() || 'http';
        if (settings.proxyUsername && settings.proxyPassword) {
          proxyUrl = `${protocol}://${settings.proxyUsername}:${settings.proxyPassword}@${settings.proxyIp}:${settings.proxyPort}`;
        } else {
          proxyUrl = `${protocol}://${settings.proxyIp}:${settings.proxyPort}`;
        }
        fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
        console.log(`🌐 Using ${settings.proxyType} proxy: ${settings.proxyIp}:${settings.proxyPort}`);
      }
    } else {
      console.log(`ℹ️ Testing direct connection (no proxy)`);
    }

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Test failed: ${response.status} ${response.statusText}`);
      res.status(response.status).json({ 
        success: false,
        message: `Connection test failed: ${response.status} ${response.statusText}`,
        error: errorText
      });
      return;
    }

    const responseData = await response.json() as any;
    console.log(`✅ Test successful! Retrieved ${responseData.data?.length || 0} models`);

    res.status(200).json({
      success: true,
      message: "Connection test successful!",
      proxyUsed: settings.proxyEnabled,
      modelsCount: responseData.data?.length || 0
    });
  } catch (error: any) {
    console.error('❌ Test error:', error);
    res.status(500).json({ 
      success: false,
      message: "Connection test failed", 
      error: error.message 
    });
  }
};

