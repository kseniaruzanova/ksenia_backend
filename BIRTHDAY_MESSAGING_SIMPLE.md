# Простая функция отправки сообщений пользователям с датой рождения

## Описание

Простая функция, которая каждый день в 9:00 утра отправляет сообщения всем пользователям, у которых указана дата рождения в профиле.

## Что делает функция

1. **Находит всех пользователей** с указанной датой рождения (поле `birthday` не пустое)
2. **Отправляет простое сообщение** каждому пользователю с его датой рождения
3. **Работает автоматически** каждый день в 9:00 утра по московскому времени

## Формат сообщения

```
🎂 Дорогой(ая) [Имя пользователя]! Ваша дата рождения: [дата]. Желаем вам всего самого лучшего! ✨
```

## Как использовать

### Автоматический запуск

Функция запускается автоматически при старте приложения. Никаких дополнительных действий не требуется.

### Ручное управление через API

#### Включить/выключить сервис:
```bash
curl -X PUT http://localhost:3000/api/birthday-messaging/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"enabled": true}'
```

#### Запустить планировщик:
```bash
curl -X POST http://localhost:3000/api/birthday-messaging/scheduler/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Остановить планировщик:
```bash
curl -X POST http://localhost:3000/api/birthday-messaging/scheduler/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Принудительно отправить сообщения сейчас:
```bash
curl -X POST http://localhost:3000/api/birthday-messaging/send-now \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Посмотреть всех пользователей с датой рождения:
```bash
curl -X GET http://localhost:3000/api/birthday-messaging/users/birthday-today \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Использование в коде

```typescript
import { sendBirthdayMessagesToAllUsers, startBirthdayScheduler, stopBirthdayScheduler } from './utils/sendBirthdayMessages';

// Отправить сообщения всем пользователям сейчас
await sendBirthdayMessagesToAllUsers();

// Запустить планировщик
startBirthdayScheduler();

// Остановить планировщик
stopBirthdayScheduler();
```

## Требования к данным

В модели `User` должно быть заполнено поле `birthday` в любом формате (например: "15.12.95", "15.12", "1995-12-15" и т.д.).

## Логирование

Функция ведет подробные логи:
- ✅ Успешная отправка сообщений
- ❌ Ошибки отправки
- 📊 Статистика выполнения
- ⏰ Планирование задач

## Безопасность

- Все API endpoints требуют аутентификации
- Доступ только для администраторов
- Обработка ошибок и исключений

## Интеграция

Функция интегрирована с:
- **BotManager** - для отправки сообщений через Telegram
- **User Model** - для получения данных пользователей
- **Cron Jobs** - для автоматического выполнения

## Мониторинг

Сервис отправляет события для мониторинга:
- `birthday:sent` - сообщение отправлено
- `birthday:failed` - ошибка отправки
- `birthday:completed` - завершение массовой отправки
- `scheduler:started` - планировщик запущен
- `scheduler:stopped` - планировщик остановлен
