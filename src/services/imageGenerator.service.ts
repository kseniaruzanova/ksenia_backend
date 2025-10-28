import path from 'path';
import fs from 'fs';
import axios from 'axios';
import AISettings from '../models/aiSettings.model';
import queueService from './queue.service';
import threadPoolService from './threadPool.service';
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Константы для генерации изображений
const REEL_IMAGE_SIZE = '1024x1024'; // DALL-E 2 поддерживает: 256x256, 512x512, 1024x1024
const IMAGES_PER_BLOCK = 5;
const IMAGE_DURATION_PER_SECOND = 2; // 2 секунды на изображение
const MAX_CONCURRENT_IMAGE_REQUESTS = 3; // Максимум одновременных запросов к DALL-E
const MAX_CONCURRENT_BLOCKS = 2; // Максимум одновременных блоков

/**
 * Сервис для генерации изображений через OpenAI DALL-E
 */
class ImageGeneratorService {
  
  /**
   * Обновляет прогресс генерации изображений для блока
   */
  private async updateBlockProgress(reelId: string, blockIndex: number, progress: number, status: 'generating' | 'completed' | 'failed', error?: string) {
    try {
      console.log(`🔍 updateBlockProgress called with reelId: ${reelId} (type: ${typeof reelId}, length: ${reelId?.length})`);
      
      // Проверяем, что reelId является валидным ObjectId
      if (!reelId || reelId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(reelId)) {
        console.warn(`⚠️ Invalid reelId format: ${reelId}, skipping progress update`);
        return;
      }

      const Reel = require('../models/reel.model').default;
      
      // Используем findByIdAndUpdate для безопасного обновления
      const updateData: any = {
        [`blocks.${blockIndex}.imageGenerationProgress`]: progress,
        [`blocks.${blockIndex}.imageGenerationStatus`]: status
      };
      
      if (error) {
        updateData[`blocks.${blockIndex}.imageGenerationError`] = error;
      }
      
      await Reel.findByIdAndUpdate(
        reelId,
        { $set: updateData },
        { new: true }
      );
      
      console.log(`📊 Block ${blockIndex} progress updated: ${progress}% (${status})`);
    } catch (error) {
      console.error(`❌ Failed to update block progress:`, error);
    }
  }

  /**
   * Создает семафор для ограничения количества одновременных запросов
   */
  private createSemaphore(maxConcurrent: number) {
    let current = 0;
    const queue: Array<() => void> = [];
    
    return async <T>(fn: () => Promise<T>): Promise<T> => {
      return new Promise((resolve, reject) => {
        const execute = async () => {
          current++;
          try {
            const result = await fn();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            current--;
            if (queue.length > 0) {
              const next = queue.shift()!;
              next();
            }
          }
        };
        
        if (current < maxConcurrent) {
          execute();
        } else {
          queue.push(execute);
        }
      });
    };
  }

  /**
   * Разбивает массив на чанки для батчевой обработки
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  /**
   * Генерирует одно изображение через OpenAI DALL-E API
   */
  private async generateSingleImage(
    prompt: string, 
    imageIndex: number, 
    blockIndex: number, 
    reelId: string,
    apiKey: string,
    fetchAgent: any
  ): Promise<string> {
      const imageDir = path.join(process.cwd(), 'uploads', 'images');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

    const imageFilename = `image_${reelId}_block${blockIndex}_${imageIndex}_${Date.now()}.png`;
        const imagePath = path.join(imageDir, imageFilename);
        
    console.log(`  🖼️  Generating image ${imageIndex + 1}: "${prompt.substring(0, 50)}..."`);
        
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
        
    console.log(`  ✅ Image ${imageIndex + 1} generated: ${imageFilename}`);
        console.log(`  📁 Image saved to: ${imagePath}`);
        console.log(`  🌐 Image URL for frontend: ${imageUrlForFrontend}`);
    
    return imageUrlForFrontend;
  }

  /**
   * Генерирует изображения для блока через OpenAI DALL-E API с параллельной обработкой и обновлением прогресса
   */
  async generateImagesForBlock(imagePrompts: string[], blockIndex: number, reelId: string, targetCount?: number): Promise<string[]> {
    try {
      console.log(`🔍 generateImagesForBlock called with reelId: ${reelId} (type: ${typeof reelId}, length: ${reelId?.length})`);
      
      const settings = await AISettings.findOne();
      const apiKey = settings?.openaiApiKey;
      
      console.log(`🔑 OpenAI API key status: ${apiKey ? 'configured' : 'not configured'}`);
      
      if (!apiKey) {
        console.warn('⚠️ OpenAI API key not configured, using mock images');
        return this.generateMockImages(imagePrompts, blockIndex, reelId);
      }

      // Обновляем прогресс на начало генерации
      await this.updateBlockProgress(reelId, blockIndex, 0, 'generating');

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

      console.log(`🎨 Generating ${imagePrompts.length} images for block ${blockIndex} in parallel...`);
      
      // Создаем семафор для ограничения одновременных запросов
      const semaphore = this.createSemaphore(MAX_CONCURRENT_IMAGE_REQUESTS);
      
      // Создаем промисы для параллельной генерации изображений
      const imagePromises = imagePrompts.map((prompt, imageIndex) => 
        semaphore(async () => {
          const result = await this.generateSingleImage(prompt, imageIndex, blockIndex, reelId, apiKey, fetchAgent);
          // Обновляем прогресс после каждого изображения
          const progress = Math.round(((imageIndex + 1) / imagePrompts.length) * 100);
          await this.updateBlockProgress(reelId, blockIndex, progress, 'generating');
          return result;
        })
      );
      
      // Ждем завершения всех промисов с обработкой ошибок
      const results = await Promise.allSettled(imagePromises);
      
      // Обрабатываем результаты
      const successfulImages: string[] = [];
      const failedImages: string[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulImages.push(result.value);
        } else {
          console.error(`❌ Failed to generate image ${index + 1} for block ${blockIndex}:`, result.reason);
          failedImages.push(`Failed image ${index + 1}`);
        }
      });
      
      console.log(`✅ Image generation for block ${blockIndex} completed:`);
      console.log(`   ✅ Successful: ${successfulImages.length}/${imagePrompts.length}`);
      console.log(`   ❌ Failed: ${failedImages.length}/${imagePrompts.length}`);
      
      if (successfulImages.length === 0) {
        await this.updateBlockProgress(reelId, blockIndex, 0, 'failed', 'All images failed to generate');
        throw new Error(`All images failed to generate for block ${blockIndex}`);
      }
      
      // Устанавливаем финальный статус
      await this.updateBlockProgress(reelId, blockIndex, 100, 'completed');
      return successfulImages;
      
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
    console.log(`🔍 generateMockImages called with reelId: ${reelId} (type: ${typeof reelId}, length: ${reelId?.length})`);
    
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
   * Добавляет задачу генерации изображений в очередь
   */
  async queueImageGeneration(reel: any, priority: number = 1): Promise<string> {
    const taskId = queueService.addTask({
      reelId: reel._id,
      userId: reel.userId.toString(),
      type: 'images',
      priority,
      progress: 0
    });

    console.log(`📋 Image generation queued for reel ${reel._id} (task: ${taskId})`);
    return taskId;
  }

  /**
   * Генерирует изображения для всех блоков рилса с параллельной обработкой и очередями
   */
  async generateImagesForReel(reel: any): Promise<void> {
    if (!reel.blocks || reel.blocks.length === 0) {
      console.warn('⚠️ No blocks found for image generation');
      return;
    }

    console.log(`🎨 Starting parallel image generation for ${reel.blocks.length} blocks with thread pool...`);
    
    // Фильтруем блоки с промптами
    const blocksWithPrompts = reel.blocks
      .map((block: any, index: number) => ({ block, index }))
      .filter(({ block }: any) => block.imagePrompts && block.imagePrompts.length > 0);
    
    if (blocksWithPrompts.length === 0) {
      console.warn('⚠️ No blocks with image prompts found');
      return;
    }
    
    console.log(`📊 Processing ${blocksWithPrompts.length} blocks with image prompts using thread pool`);
    
    // Создаем задачи для пула потоков
    const threadTasks = blocksWithPrompts.map(({ block, index }: any) => ({
      type: 'generateImages',
      data: {
        block,
        blockIndex: index,
        reelId: reel._id,
        imagePrompts: block.imagePrompts
      }
    }));
    
    // Выполняем задачи в пуле потоков
    const threadPromises = threadTasks.map((task: any) => 
      threadPoolService.executeTask(task)
    );
    
    // Ждем завершения всех задач в пуле потоков
    const results = await Promise.allSettled(threadPromises);
    
    // Обрабатываем результаты из пула потоков
    const successfulBlocks: any[] = [];
    const failedBlocks: any[] = [];
    let totalImages = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const threadResult = result.value;
        // Обновляем блок с сгенерированными изображениями
        const { blockIndex, images } = threadResult;
        if (images && images.length > 0) {
          reel.blocks[blockIndex].images = images;
          successfulBlocks.push({ success: true, blockIndex, imageCount: images.length });
          totalImages += images.length;
          console.log(`✅ Block ${blockIndex + 1}: Generated ${images.length} images via thread pool`);
        } else {
          failedBlocks.push({ success: false, blockIndex, error: 'No images generated' });
        }
      } else {
        console.error(`❌ Thread task ${index + 1} rejected:`, result.reason);
        failedBlocks.push({ 
          success: false, 
          blockIndex: index, 
          error: result.reason instanceof Error ? result.reason.message : 'Thread task rejected' 
        });
      }
    });
    
    console.log(`🎨 Image generation completed for reel ${reel._id}:`);
    console.log(`   ✅ Successful blocks: ${successfulBlocks.length}/${blocksWithPrompts.length}`);
    console.log(`   ❌ Failed blocks: ${failedBlocks.length}/${blocksWithPrompts.length}`);
    console.log(`   🖼️  Total images generated: ${totalImages}`);
    
    if (failedBlocks.length > 0) {
      console.warn(`⚠️ ${failedBlocks.length} blocks failed to generate images:`);
      failedBlocks.forEach(block => {
        console.warn(`   - Block ${block.blockIndex + 1}: ${block.error}`);
      });
    }
    
    // Если все блоки провалились, выбрасываем ошибку
    if (successfulBlocks.length === 0 && blocksWithPrompts.length > 0) {
      throw new Error('All blocks failed to generate images');
    }
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
