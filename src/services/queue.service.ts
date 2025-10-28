import { EventEmitter } from 'events';
import path from 'path';
import Reel from '../models/reel.model';
import videoGeneratorService from './videoGenerator.service';

export interface IGenerationTask {
  id: string;
  reelId: string;
  userId: string;
  type: 'images' | 'video' | 'tts';
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  progress?: number;
}

/**
 * Сервис очередей для управления задачами генерации
 */
class QueueService extends EventEmitter {
  private imageQueue: IGenerationTask[] = [];
  private videoQueue: IGenerationTask[] = [];
  private ttsQueue: IGenerationTask[] = [];
  private processingTasks: Map<string, IGenerationTask> = new Map();
  private maxConcurrentTasks = {
    images: 3,
    video: 2,
    tts: 2
  };

  /**
   * Добавляет задачу в очередь
   */
  addTask(task: Omit<IGenerationTask, 'id' | 'createdAt' | 'status'>): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullTask: IGenerationTask = {
      ...task,
      id: taskId,
      createdAt: new Date(),
      status: 'pending'
    };

    // Добавляем в соответствующую очередь
    switch (task.type) {
      case 'images':
        this.imageQueue.push(fullTask);
        this.imageQueue.sort((a, b) => b.priority - a.priority);
        break;
      case 'video':
        this.videoQueue.push(fullTask);
        this.videoQueue.sort((a, b) => b.priority - a.priority);
        break;
      case 'tts':
        this.ttsQueue.push(fullTask);
        this.ttsQueue.sort((a, b) => b.priority - a.priority);
        break;
    }

    console.log(`📋 Task ${taskId} added to ${task.type} queue (priority: ${task.priority})`);
    this.emit('taskAdded', fullTask);
    
    // Запускаем обработку очереди
    this.processQueue(task.type);
    
    return taskId;
  }

  /**
   * Обрабатывает очередь задач
   */
  private async processQueue(type: 'images' | 'video' | 'tts') {
    const queue = this.getQueue(type);
    const maxConcurrent = this.maxConcurrentTasks[type];
    
    // Подсчитываем активные задачи этого типа
    const activeTasks = Array.from(this.processingTasks.values())
      .filter(task => task.type === type && task.status === 'processing').length;

    // Если есть свободные слоты, запускаем новые задачи
    while (activeTasks < maxConcurrent && queue.length > 0) {
      const task = queue.shift()!;
      await this.startTask(task);
    }
  }

  /**
   * Запускает задачу
   */
  private async startTask(task: IGenerationTask) {
    task.status = 'processing';
    task.startedAt = new Date();
    this.processingTasks.set(task.id, task);

    console.log(`🚀 Starting task ${task.id} (${task.type}) for reel ${task.reelId}`);

    try {
      // Обновляем статус рилса
      await this.updateReelStatus(task.reelId, this.getStatusForType(task.type));
      
      this.emit('taskStarted', task);
      
      // Здесь будет логика выполнения задачи
      // Пока что просто имитируем выполнение
      await this.executeTask(task);
      
    } catch (error) {
      console.error(`❌ Task ${task.id} failed:`, error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.completedAt = new Date();
      
      await this.updateReelStatus(task.reelId, 'error');
      this.emit('taskFailed', task);
    } finally {
      this.processingTasks.delete(task.id);
      this.processQueue(task.type); // Обрабатываем следующую задачу
    }
  }

  /**
   * Выполняет задачу (заглушка)
   */
  private async executeTask(task: IGenerationTask) {
    switch (task.type) {
      case 'video':
        await this.executeVideoTask(task);
        break;
      default:
        // Имитация выполнения задачи для прочих типов (если не переопределены)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
        task.status = 'completed';
        task.completedAt = new Date();
        task.progress = 100;
        console.log(`✅ Task ${task.id} completed`);
        this.emit('taskCompleted', task);
        break;
    }
  }

  /**
   * Выполняет задачу генерации видео
   */
  private async executeVideoTask(task: IGenerationTask) {
    const reel = await Reel.findById(task.reelId);
    if (!reel) {
      throw new Error(`Reel not found: ${task.reelId}`);
    }

    console.log(`🎞️ Executing video generation for reel ${task.reelId}...`);
    const outputPath = await videoGeneratorService.generateVideo(reel);

    // Обновляем ссылку на видео и статус
    reel.videoUrl = `/api/uploads/videos/${path.basename(outputPath)}`;
    reel.status = 'video_created' as any;
    await reel.save();

    task.status = 'completed';
    task.completedAt = new Date();
    task.progress = 100;
    console.log(`✅ Video task ${task.id} completed. Video: ${reel.videoUrl}`);
    this.emit('taskCompleted', task);
  }

  /**
   * Получает очередь по типу
   */
  private getQueue(type: 'images' | 'video' | 'tts'): IGenerationTask[] {
    switch (type) {
      case 'images': return this.imageQueue;
      case 'video': return this.videoQueue;
      case 'tts': return this.ttsQueue;
    }
  }

  /**
   * Получает статус рилса для типа задачи
   */
  private getStatusForType(type: 'images' | 'video' | 'tts'): string {
    switch (type) {
      case 'images': return 'generating_images';
      case 'video': return 'video_generating';
      case 'tts': return 'video_generating'; // TTS является частью генерации видео
    }
  }

  /**
   * Обновляет статус рилса
   */
  private async updateReelStatus(reelId: string, status: string) {
    try {
      await Reel.findByIdAndUpdate(reelId, { status });
    } catch (error) {
      console.error(`❌ Failed to update reel ${reelId} status:`, error);
    }
  }

  /**
   * Получает статистику очередей
   */
  getStats() {
    const activeTasks = Array.from(this.processingTasks.values());
    
    return {
      queues: {
        images: {
          pending: this.imageQueue.length,
          processing: activeTasks.filter(t => t.type === 'images').length,
          maxConcurrent: this.maxConcurrentTasks.images
        },
        video: {
          pending: this.videoQueue.length,
          processing: activeTasks.filter(t => t.type === 'video').length,
          maxConcurrent: this.maxConcurrentTasks.video
        },
        tts: {
          pending: this.ttsQueue.length,
          processing: activeTasks.filter(t => t.type === 'tts').length,
          maxConcurrent: this.maxConcurrentTasks.tts
        }
      },
      totalTasks: {
        pending: this.imageQueue.length + this.videoQueue.length + this.ttsQueue.length,
        processing: this.processingTasks.size
      }
    };
  }

  /**
   * Получает задачу по ID
   */
  getTask(taskId: string): IGenerationTask | undefined {
    return this.processingTasks.get(taskId) || 
           [...this.imageQueue, ...this.videoQueue, ...this.ttsQueue]
             .find(task => task.id === taskId);
  }

  /**
   * Отменяет задачу
   */
  cancelTask(taskId: string): boolean {
    // Ищем в очередях
    const queues = [this.imageQueue, this.videoQueue, this.ttsQueue];
    for (const queue of queues) {
      const index = queue.findIndex(task => task.id === taskId);
      if (index !== -1) {
        queue.splice(index, 1);
        console.log(`❌ Task ${taskId} cancelled`);
        this.emit('taskCancelled', taskId);
        return true;
      }
    }

    // Ищем в активных задачах
    const activeTask = this.processingTasks.get(taskId);
    if (activeTask) {
      activeTask.status = 'failed';
      activeTask.error = 'Task cancelled';
      this.processingTasks.delete(taskId);
      console.log(`❌ Active task ${taskId} cancelled`);
      this.emit('taskCancelled', taskId);
      return true;
    }

    return false;
  }
}

export const queueService = new QueueService();
export default queueService;
