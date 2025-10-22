import path from 'path';
import fs from 'fs';
import AISettings from '../models/aiSettings.model';

// Константы для генерации изображений
const REEL_IMAGE_SIZE = '1024x1792'; // Вертикальный формат 9:16 для рилсов
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
      
      if (!apiKey) {
        console.warn('⚠️ OpenAI API key not configured, using mock images');
        return this.generateMockImages(imagePrompts, blockIndex, reelId);
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
        
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'dall-e-2',
            prompt: prompt,
            n: 1,
            size: REEL_IMAGE_SIZE
          })
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI DALL-E API error: ${response.status} - ${error}`);
        }
        
        const data = await response.json() as { data: { url: string }[] };
        const imageUrl = data.data[0].url;
        
        if (!imageUrl) {
          throw new Error('No image URL in OpenAI response');
        }
        
        // Скачиваем изображение
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        fs.writeFileSync(imagePath, Buffer.from(imageBuffer));
        
        // Возвращаем URL для фронтенда
        const imageUrlForFrontend = `/api/uploads/images/${imageFilename}`;
        generatedImages.push(imageUrlForFrontend);
        
        console.log(`  ✅ Image ${i + 1} generated: ${imageFilename}`);
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
   * Создает mock изображения (заглушки)
   */
  private generateMockImages(imagePrompts: string[], blockIndex: number, reelId: string): string[] {
    const imageDir = path.join(process.cwd(), 'uploads', 'images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const mockImages: string[] = [];
    
    for (let i = 0; i < imagePrompts.length; i++) {
      const mockFilename = `mock_image_${reelId}_block${blockIndex}_${i}_${Date.now()}.txt`;
      const mockPath = path.join(imageDir, mockFilename);
      
      const mockContent = `MOCK IMAGE: ${imagePrompts[i]}`;
      fs.writeFileSync(mockPath, mockContent);
      
      const imageUrlForFrontend = `/api/uploads/images/${mockFilename}`;
      mockImages.push(imageUrlForFrontend);
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
