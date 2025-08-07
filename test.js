const { Telegraf } = require('telegraf');

const bot = new Telegraf('7516917764:AAFduMK6yRK_3wutVbXm413ZXm45idTDNxY');

// Обработка любого текстового сообщения
bot.on('text', (ctx) => {
  console.log('Ваш chat_id:', ctx.chat.id); // ← вот здесь он
  bot.telegram.sendMessage(ctx.chat.id, '*Жирный текст*\n[Ссылка](https://example.com)', {
    parse_mode: 'MarkdownV2'
  });
});

// Запускаем бота в режиме поллинга
bot.launch().then(() => {
  console.log('Бот запущен (режим polling)');

  console.log('Бот запущен');

  const chatId = 82001366; // ← вставь сюда свой chat_id

  bot.telegram.sendMessage(chatId, 'Привет! Это тестовое сообщение от бота.');

});

// Грейсфул шатдаун
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
