import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import AISettings from '../models/aiSettings.model';
import Reel from '../models/reel.model';
import { IVideoGenerationProgress } from '../models/reel.model';
import queueService from './queue.service';
import threadPoolService from './threadPool.service';
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const execPromise = promisify(exec);

// Константы для параллельной обработки
const MAX_CONCURRENT_TTS_REQUESTS = 2; // Максимум одновременных TTS запросов
const MAX_CONCURRENT_BLOCKS = 2; // Максимум одновременных блоков для обработки

/**
 * Сервис для генерации видео из блоков
 */
class VideoGeneratorService {
  
  /**
   * Добавляет задачу генерации видео в очередь
   */
  async queueVideoGeneration(reel: any, priority: number = 1): Promise<string> {
    const taskId = queueService.addTask({
      reelId: reel._id,
      userId: reel.userId.toString(),
      type: 'video',
      priority,
      progress: 0
    });

    console.log(`📋 Video generation queued for reel ${reel._id} (task: ${taskId})`);
    return taskId;
  }

  /**
   * Добавляет задачу генерации TTS в очередь
   */
  async queueTTSGeneration(reel: any, priority: number = 2): Promise<string> {
    const taskId = queueService.addTask({
      reelId: reel._id,
      userId: reel.userId.toString(),
      type: 'tts',
      priority,
      progress: 0
    });

    console.log(`📋 TTS generation queued for reel ${reel._id} (task: ${taskId})`);
    return taskId;
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
   * Обновляет прогресс генерации в базе данных
   */
  private async updateProgress(reelId: string, progress: Partial<IVideoGenerationProgress>): Promise<void> {
    try {
      await Reel.findByIdAndUpdate(reelId, {
        $set: {
          'generationProgress.currentStep': progress.currentStep,
          'generationProgress.stepProgress': progress.stepProgress,
          'generationProgress.totalProgress': progress.totalProgress,
          'generationProgress.estimatedTimeRemaining': progress.estimatedTimeRemaining,
          'generationProgress.error': progress.error,
          $push: progress.logs ? { 'generationProgress.logs': { $each: progress.logs } } : {}
        }
      });
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }

  /**
   * Генерирует TTS озвучку для одного блока с использованием OpenAI TTS API
   */
  private async generateSingleTTS(
    text: string, 
    blockIndex: number, 
    reelId: string, 
    voiceSpeed: number,
    voice: string,
    apiKey: string,
    fetchAgent: any
  ): Promise<string | null> {
    try {
      const audioDir = path.join(process.cwd(), 'uploads', 'audio');
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      
      const audioFilename = `tts_${reelId}_block${blockIndex}_${Date.now()}.mp3`;
      const audioPath = path.join(audioDir, audioFilename);
      
      // Используем скорость озвучки из настроек пользователя, ограниченную диапазоном OpenAI (0.25-4.0)
      const finalSpeed = Math.max(0.25, Math.min(4.0, voiceSpeed));
      console.log(`🎙️ Generating TTS with OpenAI for block ${blockIndex} (voice: ${voice}, speed: ${finalSpeed}, original: ${voiceSpeed})...`);
      
      const response = await axios.post('https://api.openai.com/v1/audio/speech', {
        model: 'tts-1-hd',
        voice: voice || 'nova', // alloy, echo, fable, onyx, nova, shimmer
        input: text,
        speed: finalSpeed // Используем скорость из настроек пользователя
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: fetchAgent,
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      if (response.status !== 200) {
        console.error(`❌ OpenAI TTS API error details:`, response.data);
        throw new Error(`OpenAI TTS API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }
      
      fs.writeFileSync(audioPath, response.data);
      
      const stats = fs.statSync(audioPath);
      console.log(`✅ TTS generated: ${audioFilename} (${(stats.size / 1024).toFixed(2)} KB)`);
      
      return audioPath;
      
    } catch (error) {
      console.error(`❌ Error generating TTS for block ${blockIndex}:`, error);
      // Fallback to mock
      return this.generateMockTTS(text, blockIndex, reelId);
    }
  }

  /**
   * Генерирует TTS озвучку с использованием OpenAI TTS API (публичный метод)
   */
  async generateTTS(text: string, blockIndex: number, reelId: string, voiceSpeed: number = 1.0, voice: string = 'nova'): Promise<string | null> {
    try {
      const settings = await AISettings.findOne();
      const apiKey = settings?.openaiApiKey;
      
      if (!apiKey) {
        console.warn('⚠️ OpenAI API key not configured, using mock TTS');
        return this.generateMockTTS(text, blockIndex, reelId);
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
        console.log(`🌐 Using ${settings.proxyType || 'SOCKS5'} proxy for OpenAI TTS: ${settings.proxyIp}:${settings.proxyPort}`);
      } else {
        console.log(`🌐 No proxy configured for OpenAI TTS`);
      }

      return await this.generateSingleTTS(text, blockIndex, reelId, voiceSpeed, voice, apiKey, fetchAgent);
      
    } catch (error) {
      console.error(`❌ Error generating TTS for block ${blockIndex}:`, error);
      // Fallback to mock
      return this.generateMockTTS(text, blockIndex, reelId);
    }
  }

  /**
   * Создает mock TTS файл (заглушка) - возвращает null для использования тишины
   */
  private generateMockTTS(text: string, blockIndex: number, reelId: string): string | null {
    console.log(`⚠️ Mock TTS for block ${blockIndex}: "${text.substring(0, 30)}..."`);
    return null; // Возвращаем null, чтобы использовать тишину вместо невалидного аудио файла
  }

  /**
   * Генерирует видео из блоков с помощью FFmpeg
   */
  async generateVideo(reel: any): Promise<string> {
    try {
      console.log(`🎬 Starting video generation for reel ${reel._id}...`);
      
      // Обновляем прогресс - начало генерации
      await this.updateProgress(reel._id, {
        currentStep: 'Подготовка к генерации видео',
        stepProgress: 5,
        totalProgress: 5,
        estimatedTimeRemaining: 180,
        logs: ['🎬 Начинаем генерацию видео...', '📁 Создаем директории для файлов...']
      });
      
      const outputDir = path.join(process.cwd(), 'uploads', 'videos');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputFilename = `video_${reel._id}_${Date.now()}.mp4`;
      const outputPath = path.join(outputDir, outputFilename);
      
      // Шаг 1: Параллельная генерация озвучки для всех блоков
      console.log('🎙️ Step 1: Generating voice-overs in parallel...');
      await this.updateProgress(reel._id, {
        currentStep: 'Параллельная генерация озвучки',
        stepProgress: 0,
        totalProgress: 20,
        estimatedTimeRemaining: 150,
        logs: ['🎙️ Генерируем озвучку для всех блоков параллельно...']
      });
      
      // Получаем скорость озвучки из настроек пользователя (по умолчанию 1.0)
      const voiceSpeed = reel.audioSettings?.voiceSpeed ?? 1.0;
      const voice = reel.audioSettings?.voice || 'nova';
      
      console.log(`🎙️ Using voice settings: speed=${voiceSpeed}, voice=${voice}`);
      
      // Получаем настройки API один раз
      const settings = await AISettings.findOne();
      const apiKey = settings?.openaiApiKey;
      
      // Proxy setup
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
      }
      
      // Фильтруем блоки, которым нужна генерация TTS
      const blocksNeedingTTS = reel.blocks
        .map((block: any, index: number) => ({ block, index }))
        .filter(({ block }: any) => {
          // Генерируем TTS только для блоков с типом 'ai' и без существующего аудио
          const audioType = block.audioType || 'ai';
          if (audioType !== 'ai') {
            return false; // Пропускаем блоки с пользовательским аудио
          }
          // Также пропускаем блоки с загруженным пользовательским аудио
          if (block.uploadedAudioUrl) {
            return false;
          }
          const audioPathLocal = block.audioUrl ? this.urlToLocalPath(block.audioUrl) : null;
          return !audioPathLocal || !fs.existsSync(audioPathLocal);
        });
      
      if (blocksNeedingTTS.length > 0) {
        console.log(`🎙️ Generating TTS for ${blocksNeedingTTS.length} blocks in parallel...`);
        
        // Создаем семафор для ограничения одновременных TTS запросов
        const ttsSemaphore = this.createSemaphore(MAX_CONCURRENT_TTS_REQUESTS);
        
        // Создаем промисы для параллельной генерации TTS
        const ttsPromises = blocksNeedingTTS.map(({ block, index }: any) => 
          ttsSemaphore(async () => {
            try {
              await this.updateProgress(reel._id, {
                currentStep: `Генерация озвучки блока ${index + 1}/${reel.blocks.length}`,
                stepProgress: Math.round((index / reel.blocks.length) * 100),
                totalProgress: Math.round(10 + (index / blocksNeedingTTS.length) * 10),
                estimatedTimeRemaining: 150 - (index * 10),
                logs: [`🎙️ Начинаем генерацию TTS для блока ${index + 1}: "${block.text.substring(0, 30)}..."`]
              });
              
              const audioPath = await this.generateSingleTTS(block.text, index, reel._id, voiceSpeed, voice, apiKey || '', fetchAgent);
              
              await this.updateProgress(reel._id, {
                currentStep: `Озвучка блока ${index + 1}/${reel.blocks.length} завершена`,
                stepProgress: Math.round(((index + 1) / reel.blocks.length) * 100),
                totalProgress: Math.round(10 + ((index + 1) / blocksNeedingTTS.length) * 10),
                logs: [`✅ TTS для блока ${index + 1} успешно создан`]
              });
              
              console.log(`🔍 TTS result for block ${index + 1}:`, { audioPath, exists: audioPath ? fs.existsSync(audioPath) : false });
              if (audioPath) {
                block.audioUrl = `/api/uploads/audio/${path.basename(audioPath)}`;
                console.log(`✅ Block ${index + 1} audio URL set: ${block.audioUrl}`);
              } else {
                block.audioUrl = null; // Используем тишину для mock TTS
                console.log(`⚠️ Block ${index + 1} using silence (no TTS)`);
              }
              
              return { success: true, blockIndex: index };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`❌ Failed to generate TTS for block ${index + 1}:`, error);
              console.error(`   Error details:`, error instanceof Error ? error.stack : error);
              
              await this.updateProgress(reel._id, {
                currentStep: `Ошибка генерации озвучки блока ${index + 1}`,
                logs: [`❌ Ошибка TTS для блока ${index + 1}: ${errorMessage}`]
              });
              
              block.audioUrl = null; // Fallback to silence
              return { success: false, blockIndex: index, error: errorMessage };
            }
          })
        );
        
        // Ждем завершения всех TTS промисов с обработкой ошибок
        const ttsResults = await Promise.allSettled(ttsPromises);
        
        const successfulTTS: any[] = [];
        const failedTTS: any[] = [];
        
        ttsResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const ttsResult = result.value;
            if (ttsResult.success) {
              successfulTTS.push(ttsResult);
            } else {
              failedTTS.push(ttsResult);
            }
          } else {
            console.error(`❌ TTS promise ${index + 1} rejected:`, result.reason);
            failedTTS.push({ 
              success: false, 
              blockIndex: index, 
              error: result.reason instanceof Error ? result.reason.message : 'Promise rejected' 
            });
          }
        });
        
        console.log(`🎙️ TTS generation completed:`);
        console.log(`   ✅ Successful: ${successfulTTS.length}/${blocksNeedingTTS.length}`);
        console.log(`   ❌ Failed: ${failedTTS.length}/${blocksNeedingTTS.length}`);
        
        if (failedTTS.length > 0) {
          console.warn(`⚠️ ${failedTTS.length} blocks failed TTS generation, using silence:`);
          failedTTS.forEach(block => {
            console.warn(`   - Block ${block.blockIndex + 1}: ${block.error}`);
          });
        }
      } else {
        console.log('🎙️ All blocks already have TTS audio, skipping generation');
      }
      
      // Сохраняем audioUrl в базе
      await reel.save();
      
      // Шаг 2: Проверка наличия FFmpeg
      await this.updateProgress(reel._id, {
        currentStep: 'Проверка FFmpeg',
        stepProgress: 100,
        totalProgress: 25,
        estimatedTimeRemaining: 120,
        logs: ['🔍 Проверяем доступность FFmpeg...']
      });
      
      const hasFFmpeg = await this.checkFFmpegInstalled();
      
      if (!hasFFmpeg) {
        console.warn('⚠️ FFmpeg not installed, creating mock video');
        await this.updateProgress(reel._id, {
          currentStep: 'Создание тестового видео',
          stepProgress: 100,
          totalProgress: 100,
          estimatedTimeRemaining: 0,
          logs: ['⚠️ FFmpeg недоступен, создаем тестовое видео']
        });
        return this.createMockVideo(outputPath, reel);
      }
      
      // Шаг 3: Создание видео из блоков
      console.log('🎬 Step 3: Creating video with FFmpeg...');
      await this.updateProgress(reel._id, {
        currentStep: 'Создание видео блоков',
        stepProgress: 0,
        totalProgress: 80,
        estimatedTimeRemaining: 100,
        logs: ['🎬 Создаем видео блоки с помощью FFmpeg...']
      });
      
      await this.createVideoWithFFmpeg(reel, outputPath);
      
      // Финальный этап - завершение
      await this.updateProgress(reel._id, {
        currentStep: 'Завершение генерации',
        stepProgress: 100,
        totalProgress: 100,
        estimatedTimeRemaining: 0,
        logs: ['✅ Видео успешно создано!', '📊 Проверяем финальную длительность...']
      });
      
      // Проверяем финальную длительность видео
      const videoInfo = await this.getVideoInfo(outputPath);
      const actualDuration = videoInfo?.format?.duration ? parseFloat(videoInfo.format.duration) : 0;
      const expectedDuration = reel.blocks.reduce((sum: number, b: any) => sum + (b.duration || 10), 0);
      
      console.log(`\n📊 Final video stats:`);
      console.log(`   Expected duration: ${expectedDuration}s`);
      console.log(`   Actual duration: ${actualDuration.toFixed(2)}s`);
      console.log(`   Difference: ${Math.abs(expectedDuration - actualDuration).toFixed(2)}s`);
      
      console.log(`\n✅ Video generated successfully: ${outputFilename}`);
      return outputPath;
      
    } catch (error) {
      console.error('❌ Error in video generation:', error);
      
      // Обновляем прогресс с ошибкой
      await this.updateProgress(reel._id, {
        currentStep: 'Ошибка генерации',
        stepProgress: 0,
        totalProgress: 0,
        estimatedTimeRemaining: 0,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        logs: ['❌ Произошла ошибка при генерации видео', `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`]
      });
      
      throw error;
    }
  }

  /**
   * Проверяет установлен ли FFmpeg
   */
  private async checkFFmpegInstalled(): Promise<boolean> {
    try {
      await execPromise('ffmpeg -version');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Создает mock видео (заглушка)
   */
  private async createMockVideo(outputPath: string, reel: any): Promise<string> {
    // Создаем валидный mp4 с черным фоном и тишиной, чтобы фронт мог воспроизвести файл
    const totalDuration = (reel.blocks || []).reduce((sum: number, b: any) => sum + (b.duration || 10), 0) || 10;
    const command = [
      'ffmpeg',
      '-y',
      '-f', 'lavfi', '-i', `color=c=black:s=1080x1920:d=${totalDuration}`,
      '-f', 'lavfi', '-t', totalDuration.toString(), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25',
      '-c:a', 'aac',
      `"${outputPath}"`
    ].join(' ');
    try {
      console.log('⚠️ FFmpeg not found or pipeline failed, creating simple black mp4 as fallback');
      await execPromise(command);
    } catch (e) {
      // На случай если ffmpeg недоступен вообще — создадим пустой файл .mp4, чтобы не падать
      console.warn('⚠️ Failed to create mock mp4 via ffmpeg, writing empty file as last resort');
      fs.writeFileSync(outputPath, Buffer.alloc(0));
    }
    return outputPath;
  }

  /**
   * Создает видео с помощью FFmpeg
   */
  private async createVideoWithFFmpeg(reel: any, outputPath: string): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp', `video_${reel._id}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const blockVideos: string[] = [];
      
      // Создаем видео для всех блоков параллельно
      console.log(`\n🎬 Creating ${reel.blocks.length} video blocks in parallel...`);
      
      // Создаем семафор для ограничения одновременных блоков
      const blockSemaphore = this.createSemaphore(MAX_CONCURRENT_BLOCKS);
      
      // Создаем промисы для параллельного создания блоков
      const blockPromises = reel.blocks.map((block: any, i: number) => 
        blockSemaphore(async () => {
          try {
            await this.updateProgress(reel._id, {
              currentStep: `Создание блока ${i + 1}/${reel.blocks.length}`,
              stepProgress: Math.round((i / reel.blocks.length) * 100),
              totalProgress: 80,
              estimatedTimeRemaining: 100 - (i * 15),
              logs: [`🎬 Создаем блок ${i + 1}: "${block.displayText.substring(0, 30)}..."`]
            });
            
            console.log(`\n📹 Block ${i + 1}/${reel.blocks.length}: "${block.displayText.substring(0, 50)}..." (${block.duration}s, ${block.images?.length || 0} images)`);
            const blockVideoPath = await this.createBlockVideo(block, i, tempDir, reel);
            console.log(`✅ Block ${i + 1} created successfully`);
            
            return { success: true, blockIndex: i, videoPath: blockVideoPath };
          } catch (error) {
            console.error(`❌ Failed to create block ${i + 1}:`, error);
            return { success: false, blockIndex: i, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        })
      );
      
      // Ждем завершения всех блоков с обработкой ошибок
      const blockResults = await Promise.allSettled(blockPromises);
      
      // Обрабатываем результаты
      const successfulBlocks: any[] = [];
      const failedBlocks: any[] = [];
      
      blockResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const blockResult = result.value;
          if (blockResult.success) {
            successfulBlocks.push(blockResult);
          } else {
            failedBlocks.push(blockResult);
          }
        } else {
          console.error(`❌ Block video promise ${index + 1} rejected:`, result.reason);
          failedBlocks.push({ 
            success: false, 
            blockIndex: index, 
            error: result.reason instanceof Error ? result.reason.message : 'Promise rejected' 
          });
        }
      });
      
      // Сортируем по индексу блока для правильного порядка
      successfulBlocks.sort((a, b) => a.blockIndex - b.blockIndex);
      blockVideos.push(...successfulBlocks.map(r => r.videoPath));
      
      console.log(`\n✅ Video blocks creation completed:`);
      console.log(`   ✅ Successful blocks: ${successfulBlocks.length}/${reel.blocks.length}`);
      console.log(`   ❌ Failed blocks: ${failedBlocks.length}/${reel.blocks.length}`);
      
      if (failedBlocks.length > 0) {
        console.warn(`⚠️ ${failedBlocks.length} blocks failed to create video:`);
        failedBlocks.forEach(block => {
          console.warn(`   - Block ${block.blockIndex + 1}: ${block.error}`);
        });
      }
      
      // Если все блоки провалились, выбрасываем ошибку
      if (successfulBlocks.length === 0 && reel.blocks.length > 0) {
        throw new Error('All video blocks failed to create');
      }
      
      // Обновляем прогресс - этап объединения
      await this.updateProgress(reel._id, {
        currentStep: 'Объединение блоков в финальное видео',
        stepProgress: 0,
        totalProgress: 95,
        estimatedTimeRemaining: 30,
        logs: ['🔗 Объединяем все блоки в финальное видео...']
      });
      
      // Объединяем все блоки в одно видео
      await this.concatenateVideos(blockVideos, outputPath, reel.backgroundMusic, reel.audioSettings, reel.blocks);
      
      // Удаляем временные файлы
      this.cleanupTempFiles(tempDir);
      
    } catch (error) {
      console.error('❌ Error creating video with FFmpeg:', error);
      // Удаляем временные файлы даже при ошибке
      this.cleanupTempFiles(tempDir);
      throw error;
    }
  }

  /**
   * Создает видео для одного блока
   */
  private async createBlockVideo(block: any, index: number, tempDir: string, reel: any): Promise<string> {
    const blockOutputPath = path.join(tempDir, `block_${index}.mp4`);
    
    console.log(`🔍 Creating block ${index + 1} video:`, {
      hasImages: !!(block.images && block.images.length > 0),
      imageCount: block.images?.length || 0,
      audioUrl: block.audioUrl,
      audioExists: block.audioUrl ? fs.existsSync(this.urlToLocalPath(block.audioUrl)) : false
    });
    
    // Если нет изображений, создаем черный фон
    if (!block.images || block.images.length === 0) {
      await this.createVideoWithBlackBackground(block, blockOutputPath, reel);
    } else {
      await this.createVideoWithImages(block, blockOutputPath, reel);
    }
    
    return blockOutputPath;
  }

  /**
   * Создает FFmpeg фильтр для анимации изображения
   * Только два эффекта: zoom-in и swipe
   * Для нечетных блоков (1,3,5...) - оригинальный эффект, для четных (0,2,4...) - обратный эффект
   */
  private getImageAnimationFilter(animation: string, duration: number, blockIndex: number): string {
    const frames = duration * 25;
    const isEven = blockIndex % 2 === 0; // Четные блоки (0,2,4...) - обратный эффект, нечетные (1,3,5...) - оригинальный
    
    console.log(`  🎭 Animation filter: ${animation}, blockIndex: ${blockIndex}, isEven: ${isEven}, duration: ${duration}s, frames: ${frames}`);
    
    switch (animation) {
      case 'zoom-in':
        if (isEven) {
          // Обратный zoom-in для четных (0,2,4...): начинается с большего масштаба и уменьшается (zoom-out эффект)
          const filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='1.2-max(on/25.0/${duration}*0.2,0)':d=${frames}:s=1080x1920:fps=25`;
          console.log(`  🔍 Applying reverse zoom-in (zoom-out) filter for even block ${blockIndex}`);
          return filter;
        } else {
          // Оригинальный zoom-in для нечетных (1,3,5...): начинается с меньшего масштаба и увеличивается
          const filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0015,1.2)':d=${frames}:s=1080x1920:fps=25`;
          console.log(`  🔍 Applying zoom-in filter for odd block ${blockIndex}`);
          return filter;
        }
      
      case 'swipe':
        if (isEven) {
          // Обратный swipe для четных (0,2,4...): движение справа налево
          const filter = `scale=1296:1920:force_original_aspect_ratio=increase,crop=1080:1920:'(iw-1080)-(t/${duration})*(iw-1080)':(ih-1920)/2`;
          console.log(`  ↔️ Applying reverse swipe (right to left) filter for even block ${blockIndex}`);
          return filter;
        } else {
          // Оригинальный swipe для нечетных (1,3,5...): движение слева направо
          const filter = `scale=1296:1920:force_original_aspect_ratio=increase,crop=1080:1920:'(t/${duration})*(iw-1080)':(ih-1920)/2`;
          console.log(`  ↔️ Applying swipe (left to right) filter for odd block ${blockIndex}`);
          return filter;
        }
      
      default:
        // По умолчанию zoom-in
        if (isEven) {
          const filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='1.2-max(on/25.0/${duration}*0.2,0)':d=${frames}:s=1080x1920:fps=25`;
          console.log(`  🔍 Applying default reverse zoom-in filter for even block ${blockIndex}`);
          return filter;
        } else {
          const filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0015,1.2)':d=${frames}:s=1080x1920:fps=25`;
          console.log(`  🔍 Applying default zoom-in filter for odd block ${blockIndex}`);
          return filter;
        }
    }
  }

  /**
   * Экранирует текст для использования в FFmpeg drawtext
   */
  private escapeFFmpegText(text: string): string {
    return text
      .replace(/\\/g, '\\\\\\\\')   // Обратные слеши
      .replace(/'/g, "'\\\\''")     // Одинарные кавычки
      .replace(/:/g, '\\:')         // Двоеточия
      .replace(/,/g, '\\,')         // Запятые
      .replace(/%/g, '\\%');        // Проценты
  }

  /**
   * Создает фильтр для текста (обычный или последовательное появление слов)
   */
  private getTextFilter(
    displayText: string, 
    wordByWord: boolean, 
    duration: number, 
    fontPath: string, 
    audioDuration?: number,
    fontSize?: number,
    position?: string,
    fontName?: string
  ): string {
    // Используем указанный шрифт или по умолчанию Arial
    const font = fontName || 'Arial';
    
    // На Windows используем font='Arial' (через fontconfig), чтобы избежать проблем с двоеточием в путях C:\
    // На других ОС используем fontfile и экранируем двоеточия для ffmpeg filter_complex
    const useFontFile = process.platform !== 'win32' && !!fontPath;
    const fontSpec = useFontFile
      ? `:fontfile=${fontPath.replace(/:/g, '\\:')}`
      : `:font='${font}'`;
    
    // Используем указанный размер шрифта или автоматически подбираем в зависимости от длины текста
    let finalFontSize: number;
    if (fontSize && fontSize >= 20 && fontSize <= 100) {
      finalFontSize = fontSize;
    } else {
      // Автоматический подбор размера
      const textLength = displayText.length;
      if (textLength > 100) {
        finalFontSize = 45;
      } else if (textLength > 70) {
        finalFontSize = 50;
      } else if (textLength > 40) {
        finalFontSize = 55;
      } else {
        finalFontSize = 60;
      }
    }
    
    // Определяем вертикальную позицию текста
    let yPosition: string;
    const pos = position || 'bottom';
    switch (pos) {
      case 'top':
        yPosition = 'text_h+80'; // Отступ сверху 80px
        break;
      case 'center':
        yPosition = '(h-text_h)/2'; // По центру
        break;
      case 'bottom':
      default:
        yPosition = 'h-text_h-120'; // Отступ снизу 120px (чуть выше, чем было раньше)
        break;
    }
    
    if (wordByWord) {
      // Последовательное появление слов (слово за словом) синхронизировано с озвучкой
      const words = displayText.split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) {
        return ''; // Пустой текст
      }
      
      // Используем длительность аудио для синхронизации, если доступна
      // Это важно для синхронизации с реальной скоростью озвучки
      const actualDuration = audioDuration && audioDuration > 0 ? audioDuration : duration;
      
      // Время на одно слово на основе длительности аудио
      const wordDuration = actualDuration / words.length;
      const wordShowDuration = wordDuration * 0.9; // Слово показывается 90% времени
      const wordFadeDuration = wordDuration * 0.1; // Плавное появление/исчезновение 10% времени
      
      console.log(`  📝 Word-by-word: ${words.length} words, ${actualDuration.toFixed(2)}s audio (voiceSpeed affects this), ${wordDuration.toFixed(3)}s per word`);
      
      // Создаем несколько drawtext фильтров, один для каждого слова
      const textFilters: string[] = [];
      words.forEach((word, index) => {
        const escapedWord = this.escapeFFmpegText(word);
        const startTime = index * wordDuration;
        const fadeInEnd = startTime + wordFadeDuration;
        const fadeOutStart = startTime + wordShowDuration - wordFadeDuration;
        const endTime = startTime + wordShowDuration;
        
        // Альфа-канал: плавное появление, показ, плавное исчезновение
        const alpha = `if(between(t\\,${startTime}\\,${endTime})\\,if(lt(t\\,${fadeInEnd})\\,(t-${startTime})/${wordFadeDuration}\\,if(gt(t\\,${fadeOutStart})\\,(${endTime}-t)/${wordFadeDuration}\\,1))\\,0)`;
        
        textFilters.push(`drawtext=text='${escapedWord}':fontsize=${finalFontSize}:fontcolor=white:x=(w-text_w)/2:y=${yPosition}:borderw=3:bordercolor=black@0.8:shadowx=2:shadowy=2:shadowcolor=black@0.5:alpha='${alpha}'${fontSpec}`);
      });
      
      return textFilters.join(',');
    } else {
      // Статичный текст с обводкой и тенью
      const escapedText = this.escapeFFmpegText(displayText);
      return `drawtext=text='${escapedText}':fontsize=${finalFontSize}:fontcolor=white:x=(w-text_w)/2:y=${yPosition}:borderw=3:bordercolor=black@0.8:shadowx=2:shadowy=2:shadowcolor=black@0.5${fontSpec}`;
    }
  }

  /**
   * Получает путь к шрифту в зависимости от ОС
   */
  private getFontPath(): string {
    // Проверяем наличие различных шрифтов
    const possibleFonts = [
      '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',  // Alpine Linux (Docker)
      '/usr/share/fonts/noto/NotoSans-Regular.ttf',           // Alpine альтернатива
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',      // Debian/Ubuntu
      '/System/Library/Fonts/Helvetica.ttc',                   // MacOS
      'C:/Windows/Fonts/arial.ttf',                           // Windows
      '/Windows/Fonts/arial.ttf'                              // Windows альтернатива
    ];

    for (const fontPath of possibleFonts) {
      if (fs.existsSync(fontPath)) {
        console.log(`✅ Using font: ${fontPath}`);
        return fontPath;
      }
    }

    console.warn('⚠️ No font file found, FFmpeg will use default');
    return ''; // FFmpeg использует дефолтный шрифт
  }

  /**
   * Создает видео блока с черным фоном
   */
  private async createVideoWithBlackBackground(block: any, outputPath: string, reel: any): Promise<void> {
    // Проверяем тип аудио: 'ai' - используем audioUrl, 'user' - используем uploadedAudioUrl
    const audioType = block.audioType || 'ai';
    const audioUrl = audioType === 'user' ? block.uploadedAudioUrl : block.audioUrl;
    const blockAudioPath = audioUrl ? this.urlToLocalPath(audioUrl) : null;
    const fontPath = this.getFontPath();
    
    // Получаем длительность аудио (для пользовательского аудио - используем его длительность)
    let audioDuration = 0;
    let finalDuration = block.duration;
    
    if (blockAudioPath && fs.existsSync(blockAudioPath)) {
      audioDuration = await this.getAudioDuration(blockAudioPath);
      
      if (audioType === 'user' && audioDuration > 0) {
        // Для пользовательского аудио используем его длительность или block.duration (берем максимум)
        if (audioDuration > block.duration * 1.2) {
          finalDuration = block.duration;
          console.log(`  🎙️ User audio too long (${audioDuration.toFixed(2)}s > ${block.duration * 1.2}s), using block duration: ${finalDuration.toFixed(2)}s`);
        } else {
          finalDuration = Math.max(block.duration, audioDuration);
          console.log(`  🎙️ User audio duration: ${audioDuration.toFixed(2)}s, block duration: ${block.duration}s, using: ${finalDuration.toFixed(2)}s`);
        }
      } else if (audioDuration > 0) {
        // Для AI аудио используем block.duration
        finalDuration = block.duration;
      }
    }
    
    // Добавляем текст на экран (обычный или последовательное появление слов)
    const textForDisplay = block.scrollingText ? block.text : block.displayText;
    const textFilter = this.getTextFilter(
      textForDisplay, 
      block.scrollingText || false, 
      finalDuration, 
      fontPath,
      audioDuration || undefined,
      block.textFontSize,
      block.textPosition,
      block.textFont
    );
    
    // Собираем команду: 0:v = цветной фон, 1:a = аудио (tts или тишина)
    const commandParts = ['ffmpeg', '-y'];
    // Видео-вход (чёрный фон) - используем финальную длительность
    commandParts.push('-f', 'lavfi', '-i', `color=c=black:s=1080x1920:d=${finalDuration}`);
    
    if (blockAudioPath && fs.existsSync(blockAudioPath)) {
      console.log(`  🎙️ Adding ${audioType === 'user' ? 'user' : 'AI'} audio from: ${path.basename(blockAudioPath)}`);
      // Аудио-вход - используем реальное аудио
      commandParts.push('-i', `"${blockAudioPath}"`);
      
      // Для пользовательского аудио: если оно короче finalDuration - добавляем тишину в конце
      if (audioType === 'user' && audioDuration > 0 && audioDuration < finalDuration) {
        // Используем фильтр для добавления тишины в конце аудио
        const silenceDuration = finalDuration - audioDuration;
        const audioFilter = `[1:a]apad=pad_dur=${silenceDuration}[a]`;
        const videoFilter = textFilter || 'null';
        commandParts.push('-filter_complex', `"[0:v]${videoFilter}[v];${audioFilter}"`);
        commandParts.push('-map', '[v]', '-map', '[a]');
      } else {
        // Обычный маппинг: видео + аудио
        const filterComplex = textFilter ? `"[0:v]${textFilter}[v]"` : `"[0:v]null[v]"`;
        commandParts.push('-filter_complex', filterComplex);
        commandParts.push('-map', '[v]', '-map', '1:a');
        // Обрезаем аудио до finalDuration если оно длиннее
        if (audioDuration > finalDuration) {
          commandParts.push('-t', finalDuration.toString());
        }
      }
    } else {
      console.log(`  🔇 No audio file found, using silence`);
      // Аудио-вход - используем тишину
      commandParts.push('-f', 'lavfi', '-t', finalDuration.toString(), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
      // Фильтр на видео
      const filterComplex = textFilter ? `"[0:v]${textFilter}[v]"` : `"[0:v]null[v]"`;
      commandParts.push('-filter_complex', filterComplex);
      commandParts.push('-map', '[v]', '-map', '1:a');
    }
    
    // Кодеки и параметры
    commandParts.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', `"${outputPath}"`);
    
    const command = commandParts.join(' ');
    
    console.log(`  ⚫ Creating ${finalDuration.toFixed(2)}s video with black background and text`);
    await execPromise(command);
    
    // Проверяем длительность созданного видео
    const videoInfo = await this.getVideoInfo(outputPath);
    const actualDuration = videoInfo?.format?.duration ? parseFloat(videoInfo.format.duration) : 0;
    console.log(`  ✅ Black background video created (duration: ${actualDuration.toFixed(2)}s, expected: ${finalDuration.toFixed(2)}s)`);
    
    // Если длительность не совпадает (допускаем погрешность 0.2 секунды)
    if (Math.abs(actualDuration - finalDuration) > 0.2) {
      console.warn(`  ⚠️ Duration mismatch detected (${actualDuration.toFixed(2)}s vs ${finalDuration.toFixed(2)}s), fixing...`);
      await execPromise(`ffmpeg -y -i "${outputPath}" -t ${finalDuration} -c:v libx264 -pix_fmt yuv420p -r 25 -c:a copy "${outputPath}.fixed"`);
      fs.renameSync(`${outputPath}.fixed`, outputPath);
      console.log(`  ✅ Duration fixed to ${finalDuration.toFixed(2)}s`);
    }
  }

  /**
   * Конвертирует URL в локальный путь к файлу
   */
  private urlToLocalPath(url: string): string {
    // Удаляем домен если есть (https://example.com/api/uploads/... → /api/uploads/...)
    let relativePath = url.replace(/^https?:\/\/[^\/]+/, '');
    
    // Удаляем /api/ префикс (/api/uploads/... → /uploads/...)
    relativePath = relativePath.replace(/^\/api/, '');
    
    // Удаляем начальный слеш и конвертируем в локальный путь
    relativePath = relativePath.replace(/^\//, '');
    
    // Создаем полный путь (/uploads/images/... → /app/uploads/images/...)
    const localPath = path.join(process.cwd(), relativePath);
    
    console.log(`🔄 URL to Path: ${url} → ${localPath}`);
    
    // Проверяем существование файла
    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️ File not found: ${localPath}`);
    }
    
    return localPath;
  }

  /**
   * Создает видео блока с изображениями (слайдшоу)
   */
  private async createVideoWithImages(block: any, outputPath: string, reel: any): Promise<void> {
    // Проверяем тип аудио: 'ai' - используем audioUrl, 'user' - используем uploadedAudioUrl
    const audioType = block.audioType || 'ai';
    const audioUrl = audioType === 'user' ? block.uploadedAudioUrl : block.audioUrl;
    const audioPath = audioUrl ? this.urlToLocalPath(audioUrl) : null;
    const images = block.images.map((img: string) => this.urlToLocalPath(img));
    
    console.log(`  📸 Creating slideshow with ${images.length} images (${block.duration}s total)`);
    
    // Создаем файл списка для FFmpeg concat
    const listPath = path.join(path.dirname(outputPath), `list_${block.order}.txt`);
    
    // Каждое изображение показывается равное количество времени
    const durationPerImage = block.duration / images.length;
    
    console.log(`  ⏱️ Duration per image: ${durationPerImage.toFixed(2)}s (${block.duration}s total / ${images.length} images)`);
    
    // Получаем длительность аудио для синхронизации слов (один раз для всего блока)
    let audioDuration = 0;
    if (block.scrollingText) {
      const audioType = block.audioType || 'ai';
      const audioUrl = audioType === 'user' ? block.uploadedAudioUrl : block.audioUrl;
      if (audioUrl) {
        const audioPathForDuration = this.urlToLocalPath(audioUrl);
        if (fs.existsSync(audioPathForDuration)) {
          audioDuration = await this.getAudioDuration(audioPathForDuration);
        }
      }
    }
    
    // Создаем временные видео из каждого изображения с анимацией (без текста)
    const imageVideos: string[] = [];
    const fontPath = this.getFontPath();
    
    for (let i = 0; i < images.length; i++) {
      const imageVideoPath = path.join(path.dirname(outputPath), `img_${block.order}_${i}.mp4`);
      
      // Применяем анимацию изображения (для нечетных блоков - оригинальный эффект, для четных - обратный)
      const animation = block.imageAnimation || 'zoom-in';
      const animationFilter = this.getImageAnimationFilter(animation, durationPerImage, block.order - 1);
      
      // Для каждого изображения НЕ добавляем текст здесь - текст добавим позже поверх всего блока
      const imgCommand = [
        'ffmpeg',
        '-y',
        '-loop', '1',
        '-i', `"${images[i]}"`,
        '-t', durationPerImage.toString(),
        '-vf', `"${animationFilter}"`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-r', '25',
        '-an',
        `"${imageVideoPath}"`
      ].join(' ');
      
      console.log(`  🖼️  Image ${i + 1}/${images.length}: ${animation} animation (${durationPerImage.toFixed(2)}s)`);
      console.log(`  📝 FFmpeg command (first 300 chars): ${imgCommand.substring(0, 300)}...`);
      await execPromise(imgCommand);
      imageVideos.push(imageVideoPath);
    }
    
    // Объединяем изображения в одно видео
    const concatListContent = imageVideos.map(v => `file '${v}'`).join('\n');
    fs.writeFileSync(listPath, concatListContent);
    
    const concatVideoPath = path.join(path.dirname(outputPath), `concat_${block.order}.mp4`);
    await execPromise(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${concatVideoPath}"`);
    
    // Теперь добавляем текст поверх всего блока (если нужно)
    let finalVideoPath = concatVideoPath;
    if (block.displayText || block.text) {
      const textForDisplay = block.scrollingText ? block.text : block.displayText;
      const textFilter = this.getTextFilter(
        textForDisplay,
        block.scrollingText || false,
        block.duration,
        fontPath,
        audioDuration || undefined,
        block.textFontSize,
        block.textPosition,
        block.textFont
      );
      
      if (textFilter) {
        const textVideoPath = path.join(path.dirname(outputPath), `text_${block.order}.mp4`);
        const textCommand = [
          'ffmpeg',
          '-y',
          '-i', `"${concatVideoPath}"`,
          '-vf', `"${textFilter}"`,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'copy',
          `"${textVideoPath}"`
        ].join(' ');
        
        console.log(`  📝 Adding text overlay to block ${block.order}`);
        await execPromise(textCommand);
        finalVideoPath = textVideoPath;
        fs.unlinkSync(concatVideoPath);
      }
    }
    
    // Добавляем аудио - используем реальное аудио если есть, иначе тишину
    const blockAudioPath = audioUrl ? this.urlToLocalPath(audioUrl) : null;
    
    if (blockAudioPath && fs.existsSync(blockAudioPath)) {
      console.log(`  🎙️ Adding ${audioType === 'user' ? 'user' : 'AI'} audio from: ${path.basename(blockAudioPath)}`);
      
      // Получаем длительность видео и аудио
      const videoInfo = await this.getVideoInfo(finalVideoPath);
      const videoDuration = videoInfo?.format?.duration ? parseFloat(videoInfo.format.duration) : block.duration;
      const userAudioDuration = await this.getAudioDuration(blockAudioPath);
      
      let finalDuration = videoDuration;
      
      // Для пользовательского аудио: используем максимум из videoDuration и audioDuration
      if (audioType === 'user' && userAudioDuration > 0) {
        if (userAudioDuration > videoDuration * 1.2) {
          finalDuration = videoDuration;
          console.log(`  🎙️ User audio too long (${userAudioDuration.toFixed(2)}s > ${videoDuration * 1.2}s), using video duration: ${finalDuration.toFixed(2)}s`);
        } else {
          finalDuration = Math.max(videoDuration, userAudioDuration);
          console.log(`  🎙️ User audio: ${userAudioDuration.toFixed(2)}s, video: ${videoDuration.toFixed(2)}s, final: ${finalDuration.toFixed(2)}s`);
        }
      }
      
      // Если пользовательское аудио короче видео - добавляем тишину в конце
      if (audioType === 'user' && userAudioDuration > 0 && userAudioDuration < finalDuration) {
        const silenceDuration = finalDuration - userAudioDuration;
        const filterComplex = `[1:a]apad=pad_dur=${silenceDuration}[a]`;
        await execPromise(`ffmpeg -y -i "${finalVideoPath}" -i "${blockAudioPath}" -filter_complex "${filterComplex}" -map 0:v -map "[a]" -c:v copy -c:a aac -t ${finalDuration} "${outputPath}"`);
      } else {
        // Обычная обработка: нормализуем аудио и обрезаем если нужно
        const filterComplex = `[1:a]asetrate=44100,aresample=44100${userAudioDuration > finalDuration ? `,atrim=duration=${finalDuration}` : ''}[a]`;
        await execPromise(`ffmpeg -y -i "${finalVideoPath}" -i "${blockAudioPath}" -filter_complex "${filterComplex}" -map 0:v -map "[a]" -c:v copy -c:a aac -t ${finalDuration} "${outputPath}"`);
      }
      
      if (finalVideoPath !== concatVideoPath) {
        fs.unlinkSync(finalVideoPath);
      }
    } else {
      console.log(`  🔇 No audio file found, using silence`);
      const videoInfo = await this.getVideoInfo(finalVideoPath);
      const videoDuration = videoInfo?.format?.duration ? parseFloat(videoInfo.format.duration) : block.duration;
      await execPromise(`ffmpeg -y -i "${finalVideoPath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v copy -c:a aac -t ${videoDuration} "${outputPath}"`);
      if (finalVideoPath !== concatVideoPath) {
        fs.unlinkSync(finalVideoPath);
      }
    }
    
    // Удаляем временные файлы
    imageVideos.forEach(v => fs.existsSync(v) && fs.unlinkSync(v));
    fs.existsSync(listPath) && fs.unlinkSync(listPath);
    
    console.log(`  ✅ Slideshow created: ${images.length} images, ${block.duration}s total (${durationPerImage.toFixed(2)}s per image), with audio`);
    
    // Проверяем финальную длительность
    const finalVideoInfo = await this.getVideoInfo(outputPath);
    const finalDuration = finalVideoInfo?.format?.duration ? parseFloat(finalVideoInfo.format.duration) : 0;
    console.log(`  📊 Final video duration: ${finalDuration.toFixed(2)}s (expected: ${block.duration}s)`);
    
    // Если длительность не совпадает, исправляем
    if (Math.abs(finalDuration - block.duration) > 0.1) {
      console.warn(`  ⚠️ Duration mismatch detected (${finalDuration.toFixed(2)}s vs ${block.duration}s), fixing...`);
      await execPromise(`ffmpeg -y -i "${outputPath}" -t ${block.duration} -c:v libx264 -pix_fmt yuv420p -r 25 -c:a copy "${outputPath}.fixed"`);
      fs.renameSync(`${outputPath}.fixed`, outputPath);
      console.log(`  ✅ Duration fixed to ${block.duration}s`);
    }
  }

  /**
   * Получает FFmpeg xfade фильтр для перехода
   * Поддерживает различные типы переходов
   */
  private getTransitionFilter(transition: string): string {
    // Поддерживаемые переходы в FFmpeg xfade
    const supportedTransitions = [
      'fade',      // Плавное затемнение/появление
      'fadeblack', // Плавное затемнение через черный
      'fadewhite', // Плавное затемнение через белый
      'distance',  // Эффект расстояния
      'wipeleft',  // Стирание слева направо
      'wiperight', // Стирание справа налево
      'wipeup',    // Стирание снизу вверх
      'wipedown',  // Стирание сверху вниз
      'slideleft', // Скольжение слева
      'slideright',// Скольжение справа
      'slideup',   // Скольжение снизу
      'slidedown'  // Скольжение сверху
    ];
    
    // Если переход поддерживается, используем его, иначе fade по умолчанию
    const normalizedTransition = transition.toLowerCase().trim();
    if (supportedTransitions.includes(normalizedTransition)) {
      return normalizedTransition;
    }
    
    // По умолчанию используем fade
    console.log(`  ⚠️ Unknown transition "${transition}", using fade`);
    return 'fade';
  }

  /**
   * Объединяет видео с применением переходов (xfade) и сохранением аудио
   */
  private async concatenateWithTransitions(blockVideos: string[], outputPath: string, blocks: any[]): Promise<void> {
    if (blockVideos.length < 2) {
      // Если только 1 блок, просто копируем
      fs.copyFileSync(blockVideos[0], outputPath);
      console.log(`✅ Single block copied (duration: ${blocks[0].duration}s)`);
      return;
    }

    const transitionDuration = 0.5; // Длительность перехода в секундах
    
    // Получаем информацию о длительности каждого видео
    const durations: number[] = [];
    let totalDuration = 0;
    for (const block of blocks) {
      const dur = block.duration || 10;
      durations.push(dur);
      totalDuration += dur;
    }
    
    // Итоговая длительность с учетом переходов
    const finalDuration = totalDuration - (transitionDuration * (blockVideos.length - 1));
    console.log(`📊 Video stats: ${blockVideos.length} blocks, ${totalDuration}s total, ${finalDuration}s with transitions`);
    
    // Строим filter_complex для применения xfade между всеми блоками (ВИДЕО)
    let videoFilterComplex = '';
    let currentVideoLabel = '0:v';
    let offset = 0;
    
      for (let i = 0; i < blockVideos.length - 1; i++) {
      // Используем переход из блока, если указан, иначе fade
      const blockTransition = blocks[i]?.transition || 'fade';
      const transition = this.getTransitionFilter(blockTransition);
      const nextLabel = i === blockVideos.length - 2 ? 'vout' : `v${i}`;
      
      // Рассчитываем offset для перехода
      if (i === 0) {
        offset = durations[0] - transitionDuration;
      } else {
        offset += durations[i] - transitionDuration;
      }
      
      console.log(`🔀 Transition ${i + 1}: ${transition} at offset ${offset.toFixed(2)}s`);
      
      videoFilterComplex += `[${currentVideoLabel}][${i + 1}:v]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}[${nextLabel}]`;
      
      if (i < blockVideos.length - 2) {
        videoFilterComplex += ';';
      }
      
      currentVideoLabel = nextLabel;
    }
    
    // АУДИО: просто конкатенируем последовательно (длительность сохраняется)
    // Переходы влияют только на видео, аудио идет последовательно
    let audioFilterComplex = '';
    for (let i = 0; i < blockVideos.length; i++) {
      audioFilterComplex += `[${i}:a]`;
    }
    // Используем concat для точного сохранения длительности
    // Добавляем atrim для обрезки аудио с учетом переходов
    audioFilterComplex += `concat=n=${blockVideos.length}:v=0:a=1[aconcat];`;
    
    // Обрезаем аудио до длительности видео (с учетом переходов)
    audioFilterComplex += `[aconcat]atrim=end=${finalDuration}[aout]`;
    
    // Объединяем видео и аудио фильтры
    const fullFilterComplex = `${videoFilterComplex};${audioFilterComplex}`;
    
    // Строим команду FFmpeg с множественным входом
    let command = 'ffmpeg -y';
    blockVideos.forEach(video => {
      command += ` -i "${video}"`;
    });
    
    command += ` -filter_complex "${fullFilterComplex}" -map "[vout]" -map "[aout]" -c:v libx264 -pix_fmt yuv420p -r 25 -c:a aac "${outputPath}"`;
    
    console.log(`🎬 Concatenating ${blockVideos.length} blocks with transitions and synchronized audio...`);
    await execPromise(command);
    console.log(`✅ Video created with final duration: ~${finalDuration.toFixed(1)}s`);
  }

  /**
   * Объединяет блоки в финальное видео с фоновой музыкой и переходами
   */
  private async concatenateVideos(
    blockVideos: string[], 
    outputPath: string, 
    backgroundMusic?: string,
    audioSettings?: any,
    blocks?: any[]
  ): Promise<void> {
    const tempOutputPath = path.join(path.dirname(outputPath), 'temp_concat.mp4');
    
    // Всегда используем fade переходы между блоками
    if (blockVideos.length > 1) {
      console.log('🎞️ Applying transitions between blocks...');
      await this.concatenateWithTransitions(blockVideos, tempOutputPath, blocks || []);
    } else {
      // Простое объединение без переходов (сохраняет видео и аудио)
      const tempConcatList = path.join(path.dirname(outputPath), 'concat_list.txt');
      const concatContent = blockVideos.map(v => `file '${v}'`).join('\n');
      fs.writeFileSync(tempConcatList, concatContent);
      
      // Используем concat demuxer с re-encode для надежности (copy может не работать если кодеки разные)
      await execPromise(`ffmpeg -y -f concat -safe 0 -i "${tempConcatList}" -c:v libx264 -c:a aac "${tempOutputPath}"`);
      fs.unlinkSync(tempConcatList);
      
      // Подсчитываем общую длительность без переходов
      const totalDuration = blocks?.reduce((sum, b) => sum + (b.duration || 10), 0) || 0;
      console.log(`✅ All ${blockVideos.length} blocks concatenated without transitions (total: ${totalDuration}s)`);
    }
    
    // Проверяем длительность временного файла перед добавлением музыки
    const tempInfo = await this.getVideoInfo(tempOutputPath);
    const tempDuration = tempInfo?.format?.duration ? parseFloat(tempInfo.format.duration) : 0;
    console.log(`📊 Temporary video duration: ${tempDuration.toFixed(2)}s`);
    
    // Если есть фоновая музыка, накладываем её
    if (backgroundMusic) {
      const musicPath = this.urlToLocalPath(backgroundMusic);
      
      if (fs.existsSync(musicPath)) {
        console.log('🎵 Adding background music...');
        
        const voiceVolume = (audioSettings?.voiceVolume || 80) / 100;
        const musicVolume = (audioSettings?.musicVolume || 30) / 100;
        
        // Проверяем, есть ли аудиодорожка (голос) в видео после склейки
        const hasVoice = !!tempInfo?.streams?.some((s: any) => s.codec_type === 'audio');
        
        if (hasVoice) {
          // Микс голоса и музыки
          // Используем длительность видео для правильного обрезания музыки
          const videoDuration = tempDuration || 0;
          const filterComplex = `[0:a]volume=${voiceVolume}[voice];[1:a]volume=${musicVolume},atrim=duration=${videoDuration}[music];[voice][music]amix=inputs=2:duration=first[aout]`;
          await execPromise(
            `ffmpeg -y -i "${tempOutputPath}" -i "${musicPath}" -filter_complex "${filterComplex}" -map 0:v -map "[aout]" -c:v libx264 -c:a aac "${outputPath}"`
          );
        } else {
          // В видео нет аудио (например, использовались xfade по видео). Используем только музыку.
          // Получаем длительность видео для правильного обрезания музыки
          const videoDuration = tempDuration || 0;
          const filterComplex = `[1:a]volume=${musicVolume},atrim=duration=${videoDuration}[aout]`;
          await execPromise(
            `ffmpeg -y -i "${tempOutputPath}" -i "${musicPath}" -filter_complex "${filterComplex}" -map 0:v -map "[aout]" -c:v libx264 -c:a aac "${outputPath}"`
          );
        }
        
        fs.unlinkSync(tempOutputPath);
      } else {
        console.warn('⚠️ Background music file not found, skipping');
        fs.renameSync(tempOutputPath, outputPath);
      }
    } else {
      fs.renameSync(tempOutputPath, outputPath);
    }
    
    // Проверяем финальную длительность
    const finalInfo = await this.getVideoInfo(outputPath);
    const finalDuration = finalInfo?.format?.duration ? parseFloat(finalInfo.format.duration) : 0;
    console.log(`📊 Final video duration: ${finalDuration.toFixed(2)}s`);
    
    console.log('✅ All blocks concatenated into final video');
  }

  /**
   * Удаляет временные файлы
   */
  private cleanupTempFiles(tempDir: string): void {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('🧹 Temp files cleaned up');
      }
    } catch (error) {
      console.error('❌ Error cleaning up temp files:', error);
    }
  }

  /**
   * Создает превью изображение из видео
   */
  async generateThumbnail(videoPath: string): Promise<string> {
    try {
      const thumbnailPath = videoPath.replace('.mp4', '_thumb.jpg');
      
      await execPromise(
        `ffmpeg -y -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=480:-1" "${thumbnailPath}"`
      );
      
      console.log('✅ Thumbnail generated');
      return thumbnailPath;
      
    } catch (error) {
      console.error('❌ Error generating thumbnail:', error);
      throw error;
    }
  }

  /**
   * Получает информацию о видео
   */
  async getVideoInfo(videoPath: string): Promise<any> {
    try {
      const { stdout } = await execPromise(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`
      );
      
      return JSON.parse(stdout);
    } catch (error) {
      console.error('❌ Error getting video info:', error);
      return null;
    }
  }

  /**
   * Получает длительность аудио файла в секундах
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const { stdout } = await execPromise(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${audioPath}"`
      );
      
      const info = JSON.parse(stdout);
      const duration = parseFloat(info.format?.duration || '0');
      
      if (duration > 0) {
        console.log(`  🎵 Audio duration: ${duration.toFixed(2)}s`);
        return duration;
      }
      
      // Fallback: используем block.duration если не удалось получить
      return 0;
    } catch (error) {
      console.error(`  ⚠️ Error getting audio duration: ${error}`);
      return 0;
    }
  }
}

export const videoGeneratorService = new VideoGeneratorService();
export default videoGeneratorService;