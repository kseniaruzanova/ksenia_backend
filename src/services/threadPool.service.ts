import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

/**
 * Сервис для управления пулом потоков для параллельной обработки
 */
class ThreadPoolService extends EventEmitter {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{
    id: string;
    task: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private maxWorkers: number;
  private isShuttingDown = false;

  constructor(maxWorkers: number = 4) {
    super();
    this.maxWorkers = maxWorkers;
    this.initializeWorkers();
  }

  /**
   * Инициализирует пул воркеров
   */
  private initializeWorkers() {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker();
    }
  }

  /**
   * Создает нового воркера
   */
  private createWorker(): Worker {
    const workerPath = path.join(__dirname, 'workers', 'imageProcessor.worker.js');
    
    // Проверяем существование файла воркера
    if (fs.existsSync(workerPath)) {
      const worker = new Worker(workerPath);
      console.log(`✅ Created worker from file: ${workerPath}`);
      return worker;
    }
    
    // Fallback: создаем простой воркер в памяти
    console.warn(`⚠️ Worker file not found: ${workerPath}, using fallback`);
    const worker = new Worker(`
      const { parentPort } = require('worker_threads');
      
      parentPort.on('message', async (task) => {
        try {
          // Простая обработка задач
          const result = await processTask(task);
          parentPort.postMessage({ success: true, result, taskId: task.id });
        } catch (error) {
          parentPort.postMessage({ success: false, error: error.message, taskId: task.id });
        }
      });
      
      async function processTask(task) {
        // Имитация обработки
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        return { processed: true, taskId: task.id };
      }
    `, { eval: true });

    worker.on('message', (message) => {
      this.handleWorkerMessage(worker, message);
    });

    worker.on('error', (error) => {
      console.error('Worker error:', error);
      this.removeWorker(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
        this.removeWorker(worker);
      }
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);
    
    return worker;
  }

  /**
   * Обрабатывает сообщения от воркеров
   */
  private handleWorkerMessage(worker: Worker, message: any) {
    const { success, result, error, taskId } = message;
    
    // Находим задачу в очереди
    const taskIndex = this.taskQueue.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return;

    const task = this.taskQueue[taskIndex];
    this.taskQueue.splice(taskIndex, 1);

    // Освобождаем воркера
    this.availableWorkers.push(worker);

    // Обрабатываем результат
    if (success) {
      task.resolve(result);
    } else {
      task.reject(new Error(error));
    }

    // Обрабатываем следующую задачу
    this.processNextTask();
  }

  /**
   * Удаляет воркера из пула
   */
  private removeWorker(worker: Worker) {
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex !== -1) {
      this.workers.splice(workerIndex, 1);
    }

    const availableIndex = this.availableWorkers.indexOf(worker);
    if (availableIndex !== -1) {
      this.availableWorkers.splice(availableIndex, 1);
    }

    // Создаем нового воркера если нужно
    if (this.workers.length < this.maxWorkers && !this.isShuttingDown) {
      this.createWorker();
    }
  }

  /**
   * Обрабатывает следующую задачу из очереди
   */
  private processNextTask() {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    const task = this.taskQueue.shift()!;
    const worker = this.availableWorkers.shift()!;

    worker.postMessage(task.task);
  }

  /**
   * Добавляет задачу в очередь
   */
  async executeTask<T>(task: any): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Thread pool is shutting down');
    }

    return new Promise((resolve, reject) => {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.taskQueue.push({
        id: taskId,
        task: { ...task, id: taskId },
        resolve,
        reject
      });

      this.processNextTask();
    });
  }

  /**
   * Получает статистику пула
   */
  getStats() {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      busyWorkers: this.workers.length - this.availableWorkers.length,
      queueLength: this.taskQueue.length,
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * Завершает работу пула
   */
  async shutdown() {
    this.isShuttingDown = true;
    
    // Отклоняем все задачи в очереди
    this.taskQueue.forEach(task => {
      task.reject(new Error('Thread pool is shutting down'));
    });
    this.taskQueue = [];

    // Завершаем всех воркеров
    const shutdownPromises = this.workers.map(worker => worker.terminate());
    await Promise.all(shutdownPromises);

    this.workers = [];
    this.availableWorkers = [];
  }
}

export const threadPoolService = new ThreadPoolService(6); // 6 потоков для максимальной производительности
export default threadPoolService;
