import { birthdayMessagingService } from '../services/birthdayMessaging.service';

/**
 * Простая функция для отправки сообщений всем пользователям с датой рождения
 */
export const toArcana = (sum: number): number => {
    while (sum > 22) {
      sum -= 22;
    }
    return sum;
  };
export async function sendBirthdayMessagesToAllUsers() {
    try {
        console.log('🎂 Starting to send birthday messages to all users...');
        
        const result = await birthdayMessagingService.sendNow();
        
        console.log(`📊 Birthday messaging completed:`);
        console.log(`   Total users: ${result.total}`);
        console.log(`   Success: ${result.success}`);
        console.log(`   Failed: ${result.failed}`);
        
        return result;
    } catch (error) {
        console.error('❌ Error sending birthday messages:', error);
        throw error;
    }
}

/**
 * Функция для запуска планировщика ежедневных сообщений
 */
export function startBirthdayScheduler() {
    try {
        console.log('🚀 Starting birthday messaging scheduler...');
        
        // Включаем сервис
        birthdayMessagingService.updateConfig({ enabled: true });
        
        // Запускаем планировщик
        birthdayMessagingService.startBirthdayScheduler();
        
        console.log('✅ Birthday messaging scheduler started successfully');
    } catch (error) {
        console.error('❌ Error starting birthday scheduler:', error);
        throw error;
    }
}

/**
 * Функция для остановки планировщика
 */
export function stopBirthdayScheduler() {
    try {
        console.log('🛑 Stopping birthday messaging scheduler...');
        
        birthdayMessagingService.stopBirthdayScheduler();
        
        console.log('✅ Birthday messaging scheduler stopped successfully');
    } catch (error) {
        console.error('❌ Error stopping birthday scheduler:', error);
        throw error;
    }
}
