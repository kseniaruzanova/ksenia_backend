import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import AISettings from '../models/aiSettings.model';
import Reel from '../models/reel.model';
import { IVideoGenerationProgress } from '../models/reel.model';

const execPromise = promisify(exec);

/**
 * Сервис для генерации видео из блоков
 */
class VideoGeneratorService {
  
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
   * Генерирует TTS озвучку с использованием OpenAI TTS API
   */
  async generateTTS(text: string, blockIndex: number, reelId: string, voiceSpeed: number = 1.0): Promise<string | null> {
    try {
      const settings = await AISettings.findOne();
      const apiKey = settings?.openaiApiKey;
      
      if (!apiKey) {
        console.warn('⚠️ OpenAI API key not configured, using mock TTS');
        return this.generateMockTTS(text, blockIndex, reelId);
      }

      const audioDir = path.join(process.cwd(), 'uploads', 'audio');
      const audioFilename = `tts_${reelId}_block${blockIndex}_${Date.now()}.mp3`;
      const audioPath = path.join(audioDir, audioFilename);
      
      console.log(`🎙️ Generating TTS with OpenAI for block ${blockIndex}...`);
      
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1', // или tts-1-hd для лучшего качества
          voice: 'alloy', // alloy, echo, fable, onyx, nova, shimmer
          input: text,
          speed: Math.max(0.25, Math.min(4.0, voiceSpeed)) // OpenAI принимает 0.25-4.0
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI TTS API error: ${response.status} - ${error}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
      
      console.log(`✅ TTS generated: ${audioFilename}`);
      
      return audioPath;
      
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
      
      // Шаг 1: Генерация озвучки для каждого блока
      console.log('🎙️ Step 1: Generating voice-overs...');
      await this.updateProgress(reel._id, {
        currentStep: 'Генерация озвучки',
        stepProgress: 0,
        totalProgress: 20,
        estimatedTimeRemaining: 150,
        logs: ['🎙️ Генерируем озвучку для каждого блока...']
      });
      
      const voiceSpeed = reel.audioSettings?.voiceSpeed || 1.0;
      
      for (let i = 0; i < reel.blocks.length; i++) {
        const block = reel.blocks[i];
        const audioPathLocal = block.audioUrl ? this.urlToLocalPath(block.audioUrl) : null;
        
        // Обновляем прогресс для каждого блока
        await this.updateProgress(reel._id, {
          currentStep: `Генерация озвучки блока ${i + 1}/${reel.blocks.length}`,
          stepProgress: Math.round((i / reel.blocks.length) * 100),
          totalProgress: 20,
          estimatedTimeRemaining: 150 - (i * 10),
          logs: [`🎙️ Обрабатываем блок ${i + 1}: "${block.text.substring(0, 30)}..."`]
        });
        
        if (!audioPathLocal || !fs.existsSync(audioPathLocal)) {
          const audioPath = await this.generateTTS(block.text, i, reel._id, voiceSpeed);
          if (audioPath) {
            block.audioUrl = `/api/uploads/audio/${path.basename(audioPath)}`;
          } else {
            block.audioUrl = null; // Используем тишину для mock TTS
          }
        }
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
  private createMockVideo(outputPath: string, reel: any): string {
    const mockContent = JSON.stringify({
      message: 'MOCK VIDEO FILE',
      note: 'FFmpeg is required for actual video generation',
      blocks: reel.blocks.length,
      totalDuration: reel.blocks.reduce((sum: number, b: any) => sum + b.duration, 0)
    }, null, 2);
    
    fs.writeFileSync(outputPath, mockContent);
    console.log('⚠️ Created mock video file (install FFmpeg for actual video generation)');
    
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
      
      // Создаем видео для каждого блока
      console.log(`\n🎬 Creating ${reel.blocks.length} video blocks...`);
      for (let i = 0; i < reel.blocks.length; i++) {
        const block = reel.blocks[i];
        
        // Обновляем прогресс для каждого блока
        await this.updateProgress(reel._id, {
          currentStep: `Создание блока ${i + 1}/${reel.blocks.length}`,
          stepProgress: Math.round((i / reel.blocks.length) * 100),
          totalProgress: 80,
          estimatedTimeRemaining: 100 - (i * 15),
          logs: [`🎬 Создаем блок ${i + 1}: "${block.displayText.substring(0, 30)}..."`]
        });
        
        console.log(`\n📹 Block ${i + 1}/${reel.blocks.length}: "${block.displayText.substring(0, 50)}..." (${block.duration}s, ${block.images?.length || 0} images)`);
        const blockVideoPath = await this.createBlockVideo(block, i, tempDir, reel);
        blockVideos.push(blockVideoPath);
        console.log(`✅ Block ${i + 1} created successfully`);
      }
      console.log(`\n✅ All ${blockVideos.length} blocks created\n`);
      
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
   */
  private getImageAnimationFilter(animation: string, duration: number): string {
    const frames = duration * 25;
    
    switch (animation) {
      case 'zoom-in':
        // Приближение (zoom in) - начинается с 1.0, заканчивается в 1.2
        // Сначала масштабируем до нужного размера, затем применяем zoompan
        return `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z=min(zoom+0.0015\\,1.2):d=${frames}:s=1080x1920:fps=25`;
      
      case 'zoom-out':
        // Отдаление (zoom out) - начинается с 1.2, заканчивается в 1.0
        return `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z=max(zoom-0.0015\\,1.0):d=${frames}:s=1080x1920:fps=25`;
      
      case 'pan-left':
        // Движение влево (Ken Burns)
        // Сначала масштабируем больше целевого размера, затем кадрируем с движением
        return `scale=1296:1920:force_original_aspect_ratio=increase,crop=1080:1920:(t/${duration})*(iw-1080):(ih-1920)/2`;
      
      case 'pan-right':
        // Движение вправо
        return `scale=1296:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)-(t/${duration})*(iw-1080):(ih-1920)/2`;
      
      case 'none':
      default:
        // Без анимации - масштабируем и кадрируем до точного размера
        return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
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
   * Создает фильтр для текста (обычный или бегущий)
   */
  private getTextFilter(displayText: string, scrolling: boolean, duration: number, fontPath: string): string {
    const escapedText = this.escapeFFmpegText(displayText);
    const fontSpec = fontPath ? `:fontfile=${fontPath}` : '';
    
    // Автоматически подбираем размер шрифта в зависимости от длины текста
    let fontSize = 60;
    const textLength = displayText.length;
    if (textLength > 100) {
      fontSize = 45;
    } else if (textLength > 70) {
      fontSize = 50;
    } else if (textLength > 40) {
      fontSize = 55;
    }
    
    // Внимание: опция text_w не поддерживается в drawtext на нашей сборке FFmpeg.
    // Поэтому не используем её. Центрируем текст и даём обводку/тень для читаемости.
    if (scrolling) {
      // Плавное появление (fade-in) и обводка
      return `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=h-text_h-80:borderw=3:bordercolor=black@0.8:alpha='if(lt(t\\,0.3)\\,t/0.3\\,1)'${fontSpec}`;
    } else {
      // Статичный текст с обводкой и тенью
      return `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=h-text_h-80:borderw=3:bordercolor=black@0.8:shadowx=2:shadowy=2:shadowcolor=black@0.5${fontSpec}`;
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
    const audioPath = block.audioUrl ? this.urlToLocalPath(block.audioUrl) : null;
    const fontPath = this.getFontPath();
    
    // Добавляем текст на экран (обычный или бегущий)
    const textFilter = this.getTextFilter(
      block.displayText, 
      block.scrollingText || false, 
      block.duration, 
      fontPath
    );
    
    // Собираем команду: 0:v = цветной фон, 1:a = аудио (tts или тишина)
    const commandParts = ['ffmpeg', '-y'];
    // Видео-вход (чёрный фон)
    commandParts.push('-f', 'lavfi', '-i', `color=c=black:s=1080x1920:d=${block.duration}`);
    // Аудио-вход - всегда используем тишину для mock TTS
    commandParts.push('-f', 'lavfi', '-t', block.duration.toString(), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    // Фильтр на видео
    const filterComplex = `"[0:v]${textFilter}[v]"`;
    commandParts.push('-filter_complex', filterComplex);
    // Маппинг
    commandParts.push('-map', '[v]', '-map', '1:a');
    // Кодеки и параметры
    commandParts.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', `"${outputPath}"`);
    
    const command = commandParts.join(' ');
    
    console.log(`  ⚫ Creating ${block.duration}s video with black background and text`);
    await execPromise(command);
    console.log(`  ✅ Black background video created`);
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
    const audioPath = block.audioUrl ? this.urlToLocalPath(block.audioUrl) : null;
    const images = block.images.map((img: string) => this.urlToLocalPath(img));
    
    console.log(`  📸 Creating slideshow with ${images.length} images (${block.duration}s total)`);
    
    // Создаем файл списка для FFmpeg concat
    const listPath = path.join(path.dirname(outputPath), `list_${block.order}.txt`);
    
    // Каждое изображение показывается 2 секунды
    const durationPerImage = 2;
    
    console.log(`  ⏱️ Duration per image: ${durationPerImage}s`);
    
    // Создаем временные видео из каждого изображения
    const imageVideos: string[] = [];
    const fontPath = this.getFontPath();
    
    for (let i = 0; i < images.length; i++) {
      const imageVideoPath = path.join(path.dirname(outputPath), `img_${block.order}_${i}.mp4`);
      
      // Применяем анимацию изображения
      const animation = block.imageAnimation || 'zoom-in';
      const animationFilter = this.getImageAnimationFilter(animation, durationPerImage);
      
      // Добавляем текст (обычный или бегущий)
      const textFilter = this.getTextFilter(
        block.displayText,
        block.scrollingText || false,
        durationPerImage,
        fontPath
      );
      
      // Собираем полную команду
      const videoFilter = `${animationFilter},${textFilter}`;
      
      const imgCommand = [
        'ffmpeg',
        '-y',
        '-loop', '1',
        '-i', `"${images[i]}"`,
        '-t', durationPerImage.toString(),
        '-vf', `"${videoFilter}"`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-r', '25',
        '-an',
        `"${imageVideoPath}"`
      ].join(' ');
      
      console.log(`  🖼️  Image ${i + 1}/${images.length}: ${animation} animation (${durationPerImage}s)`);
      await execPromise(imgCommand);
      imageVideos.push(imageVideoPath);
    }
    
    // Объединяем изображения в одно видео
    const concatListContent = imageVideos.map(v => `file '${v}'`).join('\n');
    fs.writeFileSync(listPath, concatListContent);
    
    const concatVideoPath = path.join(path.dirname(outputPath), `concat_${block.order}.mp4`);
    await execPromise(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${concatVideoPath}"`);
    
    // Добавляем аудио - всегда используем тишину для mock TTS
    await execPromise(`ffmpeg -y -i "${concatVideoPath}" -f lavfi -t ${block.duration} -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v copy -c:a aac "${outputPath}"`);
    fs.unlinkSync(concatVideoPath);
    
    // Удаляем временные файлы
    imageVideos.forEach(v => fs.existsSync(v) && fs.unlinkSync(v));
    fs.existsSync(listPath) && fs.unlinkSync(listPath);
    
    console.log(`  ✅ Slideshow created: ${images.length} images, ${block.duration}s total, with audio`);
  }

  /**
   * Получает FFmpeg xfade фильтр для перехода
   */
  private getTransitionFilter(transition: string): string {
    switch (transition) {
      case 'fade':
        return 'fade';
      case 'dissolve':
        return 'dissolve';
      case 'wipe':
        return 'wiperight';
      case 'none':
      default:
        return null as any; // Без перехода
    }
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
      const transition = this.getTransitionFilter(blocks[i].transition || 'fade');
      const nextLabel = i === blockVideos.length - 2 ? 'vout' : `v${i}`;
      
      // Рассчитываем offset для перехода
      // Offset = начало второго видео относительно начала результата
      // Для первого перехода: duration[0] - transitionDuration
      // Для последующих: предыдущий offset + duration[i] - transitionDuration
      if (i === 0) {
        offset = durations[0] - transitionDuration;
      } else {
        offset += durations[i] - transitionDuration;
      }
      
      console.log(`🔀 Transition ${i + 1}: ${blocks[i].transition || 'fade'} at offset ${offset.toFixed(2)}s`);
      
      if (transition) {
        videoFilterComplex += `[${currentVideoLabel}][${i + 1}:v]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}[${nextLabel}]`;
      } else {
        // Без перехода - просто конкатенация
        videoFilterComplex += `[${currentVideoLabel}][${i + 1}:v]concat=n=2:v=1[${nextLabel}]`;
      }
      
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
    
    // Проверяем есть ли переходы между блоками
    const hasTransitions = blocks && blocks.some(b => b.transition && b.transition !== 'none');
    
    if (hasTransitions && blockVideos.length > 1) {
      console.log('🎞️ Applying transitions between blocks...');
      await this.concatenateWithTransitions(blockVideos, tempOutputPath, blocks);
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
}

export const videoGeneratorService = new VideoGeneratorService();
export default videoGeneratorService;

