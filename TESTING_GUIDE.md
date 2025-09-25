# Руководство по тестированию Daily Messaging

## Изменения

1. **Планировщик отключен по умолчанию** - сервис не запускается автоматически при старте приложения
2. **Добавлен роут для тестирования** - можно тестировать на одном пользователе

## Новый роут для тестирования

### POST `/api/daily-messaging/test-single`

Отправляет персонализированное сообщение одному пользователю для тестирования.

**Тело запроса:**
```json
{
  "customerId": "64a1b2c3d4e5f6789012345",
  "chatId": "123456789"
}
```

**Ответ при успехе:**
```json
{
  "message": "Test message sent successfully",
  "user": {
    "customerId": "64a1b2c3d4e5f6789012345",
    "chatId": "123456789",
    "customerName": "customer1"
  },
  "success": true
}
```

**Ответ при ошибке:**
```json
{
  "message": "User not found",
  "availableUsers": [
    {
      "customerId": "64a1b2c3d4e5f6789012345",
      "chatId": "123456789",
      "customerName": "customer1"
    }
  ]
}
```

## Примеры использования

### 1. Получить список пользователей для тестирования
```bash
curl -X GET http://localhost:3000/api/daily-messaging/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 1.1. Получить пользователей конкретного кастомера
```bash
curl -X GET "http://localhost:3000/api/daily-messaging/users-by-customer?customerId=64a1b2c3d4e5f6789012345"
```

### 1.2. Получить логи отправленных сообщений для пользователя
```bash
curl -X GET "http://localhost:3000/api/daily-messaging/sent-logs?customerId=64a1b2c3d4e5f6789012345&chatId=123456789&limit=5"
```

### 2. Тестировать на конкретном пользователе
```bash
curl -X POST http://localhost:3000/api/daily-messaging/test-single \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "64a1b2c3d4e5f6789012345",
    "chatId": "123456789"
  }'
```

### 3. Включить планировщик (когда будете готовы)
```bash
curl -X POST http://localhost:3000/api/daily-messaging/scheduler/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Отправить всем пользователям сейчас
```bash
curl -X POST http://localhost:3000/api/daily-messaging/send-now \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Логика генерации сообщений

- **Новые пользователи** (нет истории): случайное зазывающее сообщение таролога
- **Пользователи с историей**: AI-генерация на основе последних сообщений в стиле таролога
- **Fallback**: если AI недоступен, используется случайное зазывающее сообщение

## Переменные окружения

Убедитесь, что установлена переменная:
```
VSE_GPT_API_KEY=your_api_key_here
```

## Статус сервиса

Сервис готов к работе, но планировщик отключен по умолчанию. Это позволяет:
- Тестировать на отдельных пользователях
- Настраивать конфигурацию
- Запускать планировщик только когда будете готовы
