# Birthday Messaging API

API для управления автоматическими поздравлениями с днем рождения пользователей.

## Описание

Сервис автоматически отправляет сообщения всем пользователям, у которых указана дата рождения в профиле. Сообщения отправляются ежедневно в 9:00 утра по московскому времени.

## Основные возможности

- 🎂 Автоматическая отправка поздравлений с днем рождения
- ⏰ Настраиваемое время отправки (по умолчанию 9:00)
- 🌍 Поддержка различных часовых поясов
- 📊 Статистика отправленных сообщений
- 🧪 Тестирование отправки отдельным пользователям
- ⚙️ Гибкая конфигурация через API

## API Endpoints

Все запросы требуют аутентификации и прав администратора.

### Конфигурация

#### GET `/api/birthday-messaging/config`
Получить текущую конфигурацию сервиса.

**Ответ:**
```json
{
  "message": "Birthday messaging configuration",
  "config": {
    "enabled": false,
    "time": "09:00",
    "timezone": "Europe/Moscow"
  },
  "status": {
    "isRunning": false,
    "enabled": false,
    "time": "09:00",
    "timezone": "Europe/Moscow",
    "lastSentDate": null
  }
}
```

#### PUT `/api/birthday-messaging/config`
Обновить конфигурацию сервиса.

**Тело запроса:**
```json
{
  "enabled": true,
  "time": "09:00",
  "timezone": "Europe/Moscow"
}
```

**Параметры:**
- `enabled` (boolean, опционально) - включить/выключить сервис
- `time` (string, опционально) - время отправки в формате "HH:MM"
- `timezone` (string, опционально) - часовой пояс

### Управление планировщиком

#### POST `/api/birthday-messaging/scheduler/start`
Запустить планировщик поздравлений.

#### POST `/api/birthday-messaging/scheduler/stop`
Остановить планировщик поздравлений.

### Отправка сообщений

#### POST `/api/birthday-messaging/send-now`
Принудительно отправить поздравления всем пользователям с днем рождения сегодня.

**Ответ:**
```json
{
  "message": "Birthday messages sent immediately",
  "statistics": {
    "total": 5,
    "success": 4,
    "failed": 1,
    "successRate": "80.00%"
  },
  "results": [
    {
      "customerId": "...",
      "chatId": "...",
      "customerName": "User1",
      "success": true
    }
  ]
}
```

### Пользователи

#### GET `/api/birthday-messaging/users/birthday-today`
Получить список всех пользователей с указанной датой рождения.

**Ответ:**
```json
{
  "message": "Users with birthday today",
  "total": 3,
  "users": [
    {
      "customerId": "...",
      "chatId": "...",
      "customerName": "User1",
      "birthday": "15.12.95"
    }
  ]
}
```

#### POST `/api/birthday-messaging/test-single-user`
Отправить тестовое поздравление конкретному пользователю.

**Тело запроса:**
```json
{
  "customerId": "user_customer_id",
  "chatId": "user_chat_id"
}
```

### Статистика

#### GET `/api/birthday-messaging/stats`
Получить статистику работы сервиса.

**Ответ:**
```json
{
  "message": "Birthday messaging statistics",
  "config": {
    "enabled": true,
    "time": "09:00",
    "timezone": "Europe/Moscow"
  },
  "status": {
    "isRunning": true,
    "enabled": true,
    "time": "09:00",
    "timezone": "Europe/Moscow",
    "lastSentDate": "2024-01-15"
  },
  "userStats": {
    "usersWithBirthdayToday": 2
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Примеры использования

### Включение сервиса

```bash
curl -X PUT http://localhost:3000/api/birthday-messaging/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "enabled": true,
    "time": "09:00",
    "timezone": "Europe/Moscow"
  }'
```

### Запуск планировщика

```bash
curl -X POST http://localhost:3000/api/birthday-messaging/scheduler/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Принудительная отправка

```bash
curl -X POST http://localhost:3000/api/birthday-messaging/send-now \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Формат сообщений

Сообщения генерируются автоматически и включают:

1. **Персонализированное обращение** с именем пользователя
2. **Дату рождения** пользователя
3. **Поздравление**

### Пример сообщения:

```
🎂 Дорогой(ая) Иван! Ваша дата рождения: 15.12.95. Желаем вам всего самого лучшего! ✨
```

## Логирование

Сервис ведет подробные логи всех операций:

- ✅ Успешная отправка сообщений
- ❌ Ошибки отправки
- 📊 Статистика выполнения
- ⏰ Планирование задач

## Безопасность

- Все API endpoints требуют аутентификации
- Доступ только для администраторов
- Валидация всех входных параметров
- Обработка ошибок и исключений

## Интеграция

Сервис интегрирован с:
- **BotManager** - для отправки сообщений через Telegram
- **User Model** - для получения данных пользователей
- **Event System** - для логирования и мониторинга

## Мониторинг

Сервис отправляет события для мониторинга:
- `birthday:sent` - сообщение отправлено
- `birthday:failed` - ошибка отправки
- `birthday:completed` - завершение массовой отправки
- `scheduler:started` - планировщик запущен
- `scheduler:stopped` - планировщик остановлен
