# API для отправки сообщений с текстовой кнопкой "Хочу"

## Эндпоинт: `/api/messages/send-from-n8n`

### Описание
Этот эндпоинт позволяет отправлять сообщения через Telegram боты с возможностью добавления текстовой кнопки "Хочу".

### HTTP метод
`POST`

### Аутентификация
Используется API-ключ в заголовке `X-API-Key`.

### Параметры запроса

```json
{
  "customerId": "string",      // ID клиента (обязательный)
  "chat_id": "string",         // ID чата в Telegram (обязательный)
  "message": "string",         // Текст сообщения (обязательный)
  "showWantButton": boolean,   // Показать кнопку "Хочу" (необязательный, по умолчанию false)
  "removeKeyboard": boolean    // Удалить клавиатуру (необязательный, по умолчанию false)
}
```

### Примеры запросов

#### 1. Обычное сообщение без кнопки
```bash
curl -X POST http://your-server/api/messages/send-from-n8n \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "customerId": "507f1f77bcf86cd799439011",
    "chat_id": "123456789",
    "message": "Привет! Как дела?"
  }'
```

#### 2. Сообщение с текстовой кнопкой "Хочу"
```bash
curl -X POST http://your-server/api/messages/send-from-n8n \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "customerId": "507f1f77bcf86cd799439011",
    "chat_id": "123456789",
    "message": "У нас есть отличное предложение! Хотите узнать больше?",
    "showWantButton": true
  }'
```

#### 3. Сообщение с удалением клавиатуры
```bash
curl -X POST http://your-server/api/messages/send-from-n8n \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "customerId": "507f1f77bcf86cd799439011",
    "chat_id": "123456789",
    "message": "Спасибо за ответ! Клавиатура скрыта.",
    "removeKeyboard": true
  }'
```

### Ответы

#### Успешный ответ (200)
```json
{
  "success": true,
  "message": "Message sent successfully via N8N",
  "customer": "bot_username",
  "chat_id": "123456789",
  "messageLength": 25,
  "showWantButton": false,
  "removeKeyboard": false
}
```

#### Ошибка валидации (400)
```json
{
  "success": false,
  "message": "customerId, chat_id and message are required"
}
```

#### Ошибка отправки (500)
```json
{
  "success": false,
  "message": "Failed to send message",
  "error": "Bot not found",
  "customer": "unknown"
}
```

### Особенности текстовой кнопки

Когда `showWantButton: true`, пользователь увидит:
- Сообщение с текстом
- Под сообщением появится текстовая кнопка "Хочу"
- Кнопка имеет свойства:
  - `resize_keyboard: true` - подгоняется под размер экрана
  - `one_time_keyboard: true` - скрывается после нажатия

### Управление клавиатурой

#### Показ кнопки "Хочу" (`showWantButton: true`)
Когда пользователь нажимает кнопку "Хочу":
- Отправляется обычное текстовое сообщение "Хочу"
- Это сообщение обрабатывается как обычный текст через webhook
- Кнопка автоматически скрывается (из-за `one_time_keyboard: true`)

#### Удаление клавиатуры (`removeKeyboard: true`)
Когда нужно принудительно убрать клавиатуру с экрана пользователя:
- Отправляется сообщение с `remove_keyboard: true`
- Все текстовые кнопки исчезают с экрана пользователя
- Полезно для завершения диалогов или смены контекста

#### Приоритет параметров
Если одновременно переданы `showWantButton: true` и `removeKeyboard: true`, то приоритет имеет `removeKeyboard` - клавиатура будет удалена.

### Интеграция с N8N

В N8N можете использовать этот эндпоинт для:
1. Отправки обычных информационных сообщений
2. Отправки предложений с кнопкой для быстрого ответа
3. Создания интерактивных диалогов
4. Управления отображением клавиатуры (показ/скрытие)

Пример узла HTTP Request в N8N:
```json
{
  "method": "POST",
  "url": "https://your-server.com/api/messages/send-from-n8n",
  "headers": {
    "X-API-Key": "your-api-key",
    "Content-Type": "application/json"
  },
  "body": {
    "customerId": "{{ $json.customerId }}",
    "chat_id": "{{ $json.chat_id }}",
    "message": "{{ $json.message }}",
    "showWantButton": "{{ $json.showWantButton || false }}",
    "removeKeyboard": "{{ $json.removeKeyboard || false }}"
  }
}
``` 