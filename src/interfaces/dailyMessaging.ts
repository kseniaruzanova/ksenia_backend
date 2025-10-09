export interface DailyMessagingConfig {
  enabled: boolean;
  time: string; // Время в формате "HH:MM" (например, "09:00")
  timezone: string; // Часовой пояс (например, "Europe/Moscow")
  maxConcurrency: number; // Максимальное число одновременных запросов к ИИ
  perMessageDelayMs: number; // Пауза между стартом соседних отправок
  promptSystem?: string;
  promptUserTemplate?: string;
  model?: string;
  temperature?: number;
  sendFormat?: 'Markdown' | 'HTML';
}

export interface DailyUser {
  customerId: string;
  chatId: string;
  customerName: string;
  birthday: string;
}
