import path from 'path';
import fs from 'fs';
import axios from 'axios';
import AISettings from '../models/aiSettings.model';
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Константы для генерации изображений
const REEL_IMAGE_SIZE = '1024x1024'; // DALL-E 2 поддерживает: 256x256, 512x512, 1024x1024
const IMAGES_PER_BLOCK = 5;
const IMAGE_DURATION_PER_SECOND = 2; // 2 секунды на изображение

/**
 * Сервис для генерации изображений через OpenAI DALL-E
 */
class ImageGeneratorService {
  
  /**
   * Генерирует изображения для блока через OpenAI DALL-E API
   */
  async generateImagesForBlock(imagePrompts: string[], blockIndex: number, reelId: string): Promise<string[]> {
    try {
      const settings = await AISettings.findOne();
      const apiKey = settings?.openaiApiKey;
      
      console.log(`🔑 OpenAI API key status: ${apiKey ? 'configured' : 'not configured'}`);
      
      if (!apiKey) {
        console.warn('⚠️ OpenAI API key not configured, using mock images');
        return this.generateMockImages(imagePrompts, blockIndex, reelId);
      }

      // Proxy setup from DB
      let fetchAgent: any = undefined;
      if (settings?.proxyEnabled && settings.proxyIp && settings.proxyPort) {
        let proxyUrl: string;
        const type = (settings.proxyType || 'SOCKS5') as 'SOCKS5' | 'HTTP' | 'HTTPS';
        if (type === 'SOCKS5') {
          proxyUrl = settings.proxyUsername && settings.proxyPassword
            ? `socks5://${settings.proxyUsername}:${settings.proxyPassword}@${settings.proxyIp}:${settings.proxyPort}`
            : `socks5://${settings.proxyIp}:${settings.proxyPort}`;
          fetchAgent = new SocksProxyAgent(proxyUrl);
        } else {
          const protocol = type.toLowerCase();
          proxyUrl = settings.proxyUsername && settings.proxyPassword
            ? `${protocol}://${settings.proxyUsername}:${settings.proxyPassword}@${settings.proxyIp}:${settings.proxyPort}`
            : `${protocol}://${settings.proxyIp}:${settings.proxyPort}`;
          fetchAgent = new HttpsProxyAgent(proxyUrl);
        }
        console.log(`🌐 Using ${settings.proxyType || 'SOCKS5'} proxy for OpenAI images: ${settings.proxyIp}:${settings.proxyPort}`);
      } else {
        console.log(`🌐 No proxy configured for OpenAI images`);
      }

      const imageDir = path.join(process.cwd(), 'uploads', 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      const generatedImages: string[] = [];
      
      console.log(`🎨 Generating ${imagePrompts.length} images for block ${blockIndex}...`);
      
      for (let i = 0; i < imagePrompts.length; i++) {
        const prompt = imagePrompts[i];
        const imageFilename = `image_${reelId}_block${blockIndex}_${i}_${Date.now()}.png`;
        const imagePath = path.join(imageDir, imageFilename);
        
        console.log(`  🖼️  Generating image ${i + 1}/${imagePrompts.length}: "${prompt.substring(0, 50)}..."`);
        console.log(`  🌐 Using agent: ${fetchAgent ? 'YES' : 'NO'}`);
        
        const response = await axios.post('https://api.openai.com/v1/images/generations', {
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: REEL_IMAGE_SIZE
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          httpsAgent: fetchAgent,
          timeout: 30000
        });
        
        if (response.status !== 200) {
          console.error(`❌ OpenAI DALL-E API error details:`, response.data);
          throw new Error(`OpenAI DALL-E API error: ${response.status} - ${JSON.stringify(response.data)}`);
        }

        const imageUrl = response.data.data[0].url;
        
        if (!imageUrl) {
          throw new Error('No image URL in OpenAI response');
        }
        
        // Скачиваем изображение
        console.log(`  📥 Downloading image from: ${imageUrl}`);
        
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          httpsAgent: fetchAgent,
          timeout: 30000
        });
        
        if (imageResponse.status !== 200) {
          throw new Error(`Failed to download image: ${imageResponse.status}`);
        }
        
        fs.writeFileSync(imagePath, imageResponse.data);
        
        // Возвращаем URL для фронтенда
        const imageUrlForFrontend = `/api/uploads/images/${imageFilename}`;
        generatedImages.push(imageUrlForFrontend);
        
        console.log(`  ✅ Image ${i + 1} generated: ${imageFilename}`);
        console.log(`  📁 Image saved to: ${imagePath}`);
        console.log(`  🌐 Image URL for frontend: ${imageUrlForFrontend}`);
      }
      
      console.log(`✅ All ${generatedImages.length} images generated for block ${blockIndex}`);
      return generatedImages;
      
    } catch (error) {
      console.error(`❌ Error generating images for block ${blockIndex}:`, error);
      // Fallback to mock images
      return this.generateMockImages(imagePrompts, blockIndex, reelId);
    }
  }

  /**
   * Создает mock изображения (заглушки) - создает простые цветные изображения
   */
  private generateMockImages(imagePrompts: string[], blockIndex: number, reelId: string): string[] {
    const imageDir = path.join(process.cwd(), 'uploads', 'images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const mockImages: string[] = [];
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    
    for (let i = 0; i < imagePrompts.length; i++) {
      const mockFilename = `mock_image_${reelId}_block${blockIndex}_${i}_${Date.now()}.png`;
      const mockPath = path.join(imageDir, mockFilename);
      
      // Создаем простое цветное изображение с помощью FFmpeg
      const color = colors[i % colors.length];
      const command = `ffmpeg -y -f lavfi -i "color=c=${color}:s=1024x1024:d=1" -frames:v 1 "${mockPath}"`;
      
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execPromise = promisify(exec);
        
        execPromise(command).then(() => {
          console.log(`✅ Created mock image: ${mockFilename}`);
        }).catch((error: any) => {
          console.warn(`⚠️ Failed to create mock image, using text file instead: ${error.message}`);
          // Fallback к текстовому файлу
          const textFilename = mockFilename.replace('.png', '.txt');
          const textPath = path.join(imageDir, textFilename);
          fs.writeFileSync(textPath, `MOCK IMAGE: ${imagePrompts[i]}`);
          mockImages.push(`/api/uploads/images/${textFilename}`);
        });
        
        const imageUrlForFrontend = `/api/uploads/images/${mockFilename}`;
        mockImages.push(imageUrlForFrontend);
      } catch (error) {
        console.warn(`⚠️ Error creating mock image: ${error}`);
        // Fallback к текстовому файлу
        const textFilename = mockFilename.replace('.png', '.txt');
        const textPath = path.join(imageDir, textFilename);
        fs.writeFileSync(textPath, `MOCK IMAGE: ${imagePrompts[i]}`);
        mockImages.push(`/api/uploads/images/${textFilename}`);
      }
    }
    
    console.log(`⚠️ Created ${mockImages.length} mock images for block ${blockIndex}`);
    return mockImages;
  }

  /**
   * Генерирует изображения для всех блоков рилса
   */
  async generateImagesForReel(reel: any): Promise<void> {
    if (!reel.blocks || reel.blocks.length === 0) {
      console.warn('⚠️ No blocks found for image generation');
      return;
    }

    console.log(`🎨 Starting image generation for ${reel.blocks.length} blocks...`);
    
    for (let i = 0; i < reel.blocks.length; i++) {
      const block = reel.blocks[i];
      
      console.log(`🔍 Block ${i + 1}: imagePrompts = ${block.imagePrompts?.length || 0}`);
      if (block.imagePrompts && block.imagePrompts.length > 0) {
        console.log(`📝 Block ${i + 1} prompts:`, block.imagePrompts);
      }
      
      if (!block.imagePrompts || block.imagePrompts.length === 0) {
        console.warn(`⚠️ No image prompts for block ${i + 1}, skipping`);
        continue;
      }
      
      try {
        const images = await this.generateImagesForBlock(block.imagePrompts, i, reel._id);
        block.images = images;
        console.log(`✅ Block ${i + 1}: Generated ${images.length} images`);
      } catch (error) {
        console.error(`❌ Failed to generate images for block ${i + 1}:`, error);
        // Продолжаем с другими блоками
      }
    }
    
    console.log(`🎨 Image generation completed for reel ${reel._id}`);
  }

  /**
   * Перегенерирует изображения для всех блоков (при повторной генерации)
   */
  async regenerateImagesForReel(reel: any): Promise<void> {
    console.log(`♻️ Regenerating images for reel ${reel._id}...`);
    
    // Очищаем существующие изображения
    if (reel.blocks) {
      reel.blocks.forEach((block: any) => {
        block.images = [];
      });
    }
    
    // Генерируем новые изображения
    await this.generateImagesForReel(reel);
  }
}

export const imageGeneratorService = new ImageGeneratorService();
export default imageGeneratorService;
