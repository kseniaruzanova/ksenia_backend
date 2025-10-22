import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import AISettings from '../models/aiSettings.model';

const execPromise = promisify(exec);

/**
 * Сервис для генерации видео из блоков
 */
class VideoGeneratorService {
  
  /**
   * Генерирует TTS озвучку с использованием OpenAI TTS API
   */
  async generateTTS(text: string, blockIndex: number, reelId: string, voiceSpeed: number = 1.0): Promise<string> {
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
   * Создает mock TTS файл (заглушка)
   */
  private generateMockTTS(text: string, blockIndex: number, reelId: string): string {
    const audioDir = path.join(process.cwd(), 'uploads', 'audio');
    const audioFilename = `tts_mock_${reelId}_block${blockIndex}_${Date.now()}.txt`;
    const audioPath = path.join(audioDir, audioFilename);
    
    fs.writeFileSync(audioPath, `MOCK TTS: ${text}`);
    console.log(`⚠️ Created mock TTS file for block ${blockIndex}`);
    
    return audioPath;
  }

  /**
   * Генерирует видео из блоков с помощью FFmpeg
   */
  async generateVideo(reel: any): Promise<string> {
    try {
      console.log(`🎬 Starting video generation for reel ${reel._id}...`);
      
      const outputDir = path.join(process.cwd(), 'uploads', 'videos');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputFilename = `video_${reel._id}_${Date.now()}.mp4`;
      const outputPath = path.join(outputDir, outputFilename);
      
      // Шаг 1: Генерация озвучки для каждого блока
      console.log('🎙️ Step 1: Generating voice-overs...');
      const voiceSpeed = reel.audioSettings?.voiceSpeed || 1.0;
      
      for (let i = 0; i < reel.blocks.length; i++) {
        const block = reel.blocks[i];
        const audioPathLocal = block.audioUrl ? this.urlToLocalPath(block.audioUrl) : null;
        if (!audioPathLocal || !fs.existsSync(audioPathLocal)) {
          const audioPath = await this.generateTTS(block.text, i, reel._id, voiceSpeed);
          block.audioUrl = `/api/uploads/audio/${path.basename(audioPath)}`;
        }
      }
      
      // Сохраняем audioUrl в базе
      await reel.save();
      
      // Шаг 2: Проверка наличия FFmpeg
      const hasFFmpeg = await this.checkFFmpegInstalled();
      
      if (!hasFFmpeg) {
        console.warn('⚠️ FFmpeg not installed, creating mock video');
        return this.createMockVideo(outputPath, reel);
      }
      
      // Шаг 3: Создание видео из блоков
      console.log('🎬 Step 2: Creating video with FFmpeg...');
      await this.createVideoWithFFmpeg(reel, outputPath);
      
      console.log(`✅ Video generated successfully: ${outputFilename}`);
      return outputPath;
      
    } catch (error) {
      console.error('❌ Error in video generation:', error);
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
      for (let i = 0; i < reel.blocks.length; i++) {
        const block = reel.blocks[i];
        const blockVideoPath = await this.createBlockVideo(block, i, tempDir, reel);
        blockVideos.push(blockVideoPath);
      }
      
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
        // Масштабируем по высоте, сохраняем пропорции, кадрируем по центру в 1080x1920 (без растяжения)
        return `scale=-1:1920:force_original_aspect_ratio=decrease,pad=iw:1920:(iw-iw)/2:(oh-ih)/2:black,zoompan=z=min(zoom+0.0015\\,1.2):d=${frames}:s=1080x1920:fps=25`;
      
      case 'zoom-out':
        // Отдаление (zoom out) - начинается с 1.2, заканчивается в 1.0
        return `scale=-1:1920:force_original_aspect_ratio=decrease,pad=iw:1920:(iw-iw)/2:(oh-ih)/2:black,zoompan=z=max(zoom-0.0015\\,1.0):d=${frames}:s=1080x1920:fps=25`;
      
      case 'pan-left':
        // Движение влево (Ken Burns)
        // Линейное смещение без функций с запятыми: x = (t/d)*(iw-ow)
        return `scale=-1:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2:black,crop=1080:1920:(t/${duration})*(max(iw-1080\,0)):(1920-ih)/2`;
      
      case 'pan-right':
        // Движение вправо
        // Линейное смещение справа налево: x = (iw-ow) - (t/d)*(iw-ow)
        return `scale=-1:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2:black,crop=1080:1920:(max(iw-1080\,0))-(t/${duration})*(max(iw-1080\,0)):(1920-ih)/2`;
      
      case 'none':
      default:
        // Без анимации
        return 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black';
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
    const fontSpec = fontPath ? `:fontfile=${fontPath}` : '';
    
    if (scrolling) {
      // Эффект "печатной машинки": постепенно показываем текст по словам
      const words = displayText.split(/\s+/).filter(Boolean);
      const steps = Math.min(10, Math.max(1, words.length));
      const wordsPerStep = Math.ceil(words.length / steps);
      const segments: string[] = [];
      
      for (let i = 0; i < steps; i++) {
        const endIndex = Math.min(words.length, (i + 1) * wordsPerStep);
        const partialText = words.slice(0, endIndex).join(' ');
        const escaped = this.escapeFFmpegText(partialText);
        const start = (i * duration) / steps;
        const end = ((i + 1) * duration) / steps;
        segments.push(
          `drawtext=text='${escaped}':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=h-th-50:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'${fontSpec}`
        );
      }
      
      // Последний шаг держим текст до конца
      const finalText = this.escapeFFmpegText(displayText);
      segments.push(
        `drawtext=text='${finalText}':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=h-th-50:enable='gte(t,${(duration * (steps - 1) / steps).toFixed(3)})'${fontSpec}`
      );
      
      return segments.join(',');
    } else {
      // Статичный текст (внизу по центру)
      const escapedText = this.escapeFFmpegText(displayText);
      return `drawtext=text='${escapedText}':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=h-th-50${fontSpec}`;
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
    
    // Собираем команду
    const commandParts = [
      'ffmpeg',
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=black:s=1080x1920:d=${block.duration}`,
      '-vf', `"${textFilter}"`,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', '25'
    ];
    
    // Если есть озвучка, добавляем аудио
    if (audioPath && fs.existsSync(audioPath)) {
      commandParts.push('-i', `"${audioPath}"`, '-c:a', 'aac', '-shortest');
    } else {
      // Без аудио - тишина
      commandParts.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`, '-t', block.duration.toString(), '-c:a', 'aac');
    }
    
    commandParts.push(`"${outputPath}"`);
    
    const command = commandParts.join(' ');
    
    console.log(`⚙️ Creating block ${block.order} with black background...`);
    await execPromise(command);
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
    
    // Создаем файл списка для FFmpeg concat
    const listPath = path.join(path.dirname(outputPath), `list_${block.order}.txt`);
    const durationPerImage = block.duration / images.length;
    
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
      
      console.log(`⚙️ Creating image ${i + 1}/${images.length} with ${animation} animation...`);
      await execPromise(imgCommand);
      imageVideos.push(imageVideoPath);
    }
    
    // Объединяем изображения в одно видео
    const concatListContent = imageVideos.map(v => `file '${v}'`).join('\n');
    fs.writeFileSync(listPath, concatListContent);
    
    const concatVideoPath = path.join(path.dirname(outputPath), `concat_${block.order}.mp4`);
    await execPromise(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${concatVideoPath}"`);
    
    // Добавляем аудио
    if (audioPath && fs.existsSync(audioPath)) {
      await execPromise(`ffmpeg -y -i "${concatVideoPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${outputPath}"`);
      fs.unlinkSync(concatVideoPath);
    } else {
      fs.renameSync(concatVideoPath, outputPath);
    }
    
    // Удаляем временные файлы
    imageVideos.forEach(v => fs.existsSync(v) && fs.unlinkSync(v));
    fs.existsSync(listPath) && fs.unlinkSync(listPath);
    
    console.log(`✅ Block ${block.order} video created with ${images.length} images`);
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
   * Объединяет видео с применением переходов (xfade)
   */
  private async concatenateWithTransitions(blockVideos: string[], outputPath: string, blocks: any[]): Promise<void> {
    if (blockVideos.length < 2) {
      // Если только 1 блок, просто копируем
      fs.copyFileSync(blockVideos[0], outputPath);
      return;
    }

    const transitionDuration = 0.5; // Длительность перехода в секундах
    
    // Получаем информацию о длительности каждого видео
    const durations: number[] = [];
    for (const block of blocks) {
      durations.push(block.duration || 10);
    }
    
    // Строим filter_complex для применения xfade между всеми блоками
    let filterComplex = '';
    let currentLabel = '0:v';
    let offset = 0;
    
    for (let i = 0; i < blockVideos.length - 1; i++) {
      const transition = this.getTransitionFilter(blocks[i].transition || 'fade');
      const nextLabel = i === blockVideos.length - 2 ? 'vout' : `v${i}`;
      
      // Рассчитываем offset для перехода
      offset += durations[i] - transitionDuration;
      
      if (transition) {
        filterComplex += `[${currentLabel}][${i + 1}:v]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}[${nextLabel}]`;
      } else {
        // Без перехода - просто конкатенация
        filterComplex += `[${currentLabel}][${i + 1}:v]concat=n=2:v=1[${nextLabel}]`;
      }
      
      if (i < blockVideos.length - 2) {
        filterComplex += ';';
      }
      
      currentLabel = nextLabel;
    }
    
    // Строим команду FFmpeg с множественным входом
    let command = 'ffmpeg -y';
    blockVideos.forEach(video => {
      command += ` -i "${video}"`;
    });
    
    command += ` -filter_complex "${filterComplex}" -map "[vout]" -c:v libx264 -pix_fmt yuv420p -r 25 "${outputPath}"`;
    
    console.log(`🎬 Concatenating ${blockVideos.length} blocks with transitions...`);
    await execPromise(command);
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
      // Простое объединение без переходов
      const tempConcatList = path.join(path.dirname(outputPath), 'concat_list.txt');
      const concatContent = blockVideos.map(v => `file '${v}'`).join('\n');
      fs.writeFileSync(tempConcatList, concatContent);
      
      await execPromise(`ffmpeg -y -f concat -safe 0 -i "${tempConcatList}" -c copy "${tempOutputPath}"`);
      fs.unlinkSync(tempConcatList);
    }
    
    // Если есть фоновая музыка, накладываем её
    if (backgroundMusic) {
      const musicPath = this.urlToLocalPath(backgroundMusic);
      
      if (fs.existsSync(musicPath)) {
        console.log('🎵 Adding background music...');
        
        const voiceVolume = (audioSettings?.voiceVolume || 80) / 100;
        const musicVolume = (audioSettings?.musicVolume || 30) / 100;
        
        // Проверяем, есть ли аудиодорожка (голос) в видео после склейки
        const tempInfo = await this.getVideoInfo(tempOutputPath);
        const hasVoice = !!tempInfo?.streams?.some((s: any) => s.codec_type === 'audio');
        
        if (hasVoice) {
          // Микс голоса и музыки
          const filterComplex = `[0:a]volume=${voiceVolume}[voice];[1:a]volume=${musicVolume},aloop=loop=-1:size=2e+09[music];[voice][music]amix=inputs=2:duration=first[aout]`;
          await execPromise(
            `ffmpeg -y -i "${tempOutputPath}" -i "${musicPath}" -filter_complex "${filterComplex}" -map 0:v -map "[aout]" -c:v copy -c:a aac "${outputPath}"`
          );
        } else {
          // В видео нет аудио (например, использовались xfade по видео). Используем только музыку.
          const filterComplex = `[1:a]volume=${musicVolume},aloop=loop=-1:size=2e+09[aout]`;
          await execPromise(
            `ffmpeg -y -i "${tempOutputPath}" -i "${musicPath}" -filter_complex "${filterComplex}" -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${outputPath}"`
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

