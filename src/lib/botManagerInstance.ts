let botManagerInstance: any = null;

/**
 * Устанавливает глобальный экземпляр BotManager
 * @param instance - экземпляр BotManager
 */
export const setBotManagerInstance = (instance: any): void => {
  botManagerInstance = instance;
};

/**
 * Получает глобальный экземпляр BotManager
 * @returns экземпляр BotManager или null
 */
export const getBotManagerInstance = (): any => {
  return botManagerInstance;
};

