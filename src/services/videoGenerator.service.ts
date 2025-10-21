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
        if (!block.audioUrl) {
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
      await this.concatenateVideos(blockVideos, outputPath, reel.backgroundMusic, reel.audioSettings);
      
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
   * Создает видео блока с черным фоном
   */
  private async createVideoWithBlackBackground(block: any, outputPath: string, reel: any): Promise<void> {
    const audioPath = block.audioUrl ? path.join(process.cwd(), block.audioUrl.replace(/^\//, '')) : null;
    
    let command = `ffmpeg -y -f lavfi -i color=c=black:s=1080x1920:d=${block.duration} -vf "`;
    
    // Добавляем текст на экран
    const displayText = block.displayText.replace(/'/g, "\\'").replace(/:/g, "\\:");
    command += `drawtext=text='${displayText}':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:fontfile=/Windows/Fonts/arial.ttf`;
    command += `" -c:v libx264 -pix_fmt yuv420p`;
    
    // Если есть озвучка, добавляем аудио
    if (audioPath && fs.existsSync(audioPath)) {
      command += ` -i "${audioPath}" -c:a aac -shortest`;
    } else {
      // Без аудио - тишина
      command += ` -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${block.duration} -c:a aac`;
    }
    
    command += ` "${outputPath}"`;
    
    console.log(`⚙️ Creating block ${block.order} with black background...`);
    await execPromise(command);
  }

  /**
   * Создает видео блока с изображениями (слайдшоу)
   */
  private async createVideoWithImages(block: any, outputPath: string, reel: any): Promise<void> {
    const audioPath = block.audioUrl ? path.join(process.cwd(), block.audioUrl.replace(/^\//, '')) : null;
    const images = block.images.map((img: string) => path.join(process.cwd(), img.replace(/^\//, '')));
    
    // Создаем файл списка для FFmpeg concat
    const listPath = path.join(path.dirname(outputPath), `list_${block.order}.txt`);
    const durationPerImage = block.duration / images.length;
    
    // Создаем временные видео из каждого изображения
    const imageVideos: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const imageVideoPath = path.join(path.dirname(outputPath), `img_${block.order}_${i}.mp4`);
      
      const displayText = block.displayText.replace(/'/g, "\\'").replace(/:/g, "\\:");
      let imgCommand = `ffmpeg -y -loop 1 -i "${images[i]}" -t ${durationPerImage} -vf "`;
      imgCommand += `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,`;
      imgCommand += `drawtext=text='${displayText}':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=h-th-50:fontfile=/Windows/Fonts/arial.ttf`;
      imgCommand += `" -c:v libx264 -pix_fmt yuv420p -an "${imageVideoPath}"`;
      
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
   * Объединяет блоки в финальное видео с фоновой музыкой
   */
  private async concatenateVideos(
    blockVideos: string[], 
    outputPath: string, 
    backgroundMusic?: string,
    audioSettings?: any
  ): Promise<void> {
    const tempConcatList = path.join(path.dirname(outputPath), 'concat_list.txt');
    const concatContent = blockVideos.map(v => `file '${v}'`).join('\n');
    fs.writeFileSync(tempConcatList, concatContent);
    
    const tempOutputPath = path.join(path.dirname(outputPath), 'temp_concat.mp4');
    
    // Объединяем все блоки
    await execPromise(`ffmpeg -y -f concat -safe 0 -i "${tempConcatList}" -c copy "${tempOutputPath}"`);
    
    // Если есть фоновая музыка, накладываем её
    if (backgroundMusic) {
      const musicPath = path.join(process.cwd(), backgroundMusic.replace(/^\//, ''));
      
      if (fs.existsSync(musicPath)) {
        console.log('🎵 Adding background music...');
        
        const voiceVolume = (audioSettings?.voiceVolume || 80) / 100;
        const musicVolume = (audioSettings?.musicVolume || 30) / 100;
        
        // Миксуем голос с музыкой
        const filterComplex = `[0:a]volume=${voiceVolume}[voice];[1:a]volume=${musicVolume},aloop=loop=-1:size=2e+09[music];[voice][music]amix=inputs=2:duration=first[aout]`;
        
        await execPromise(
          `ffmpeg -y -i "${tempOutputPath}" -i "${musicPath}" -filter_complex "${filterComplex}" -map 0:v -map "[aout]" -c:v copy -c:a aac "${outputPath}"`
        );
        
        fs.unlinkSync(tempOutputPath);
      } else {
        console.warn('⚠️ Background music file not found, skipping');
        fs.renameSync(tempOutputPath, outputPath);
      }
    } else {
      fs.renameSync(tempOutputPath, outputPath);
    }
    
    // Удаляем файл списка
    fs.existsSync(tempConcatList) && fs.unlinkSync(tempConcatList);
    
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

