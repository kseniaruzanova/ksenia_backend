# API управления контентом

Система для управления контентом супер администратором. Позволяет создавать, редактировать и управлять контентными блоками с заголовком, описанием и markdown-контентом.

## Эндпоинты

### Публичные эндпоинты

#### GET /api/content/active
Получить все активные контентные блоки (доступно без аутентификации)

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345",
      "title": "Заголовок блока",
      "description": "Краткое описание",
      "content": "# Markdown контент\n\nТекст в формате markdown",
      "isActive": true,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

### Защищенные эндпоинты (только для супер администратора)

Все следующие эндпоинты требуют заголовок:
```
Authorization: Bearer <JWT_TOKEN>
```

#### GET /api/content
Получить все контентные блоки с пагинацией

**Query параметры:**
- `page` (number, optional) - номер страницы (по умолчанию: 1)
- `limit` (number, optional) - количество элементов на странице (по умолчанию: 10)
- `isActive` (boolean, optional) - фильтр по активности

**Пример запроса:**
```
GET /api/content?page=1&limit=5&isActive=true
```

**Ответ:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

#### GET /api/content/:id
Получить контентный блок по ID

**Параметры:**
- `id` - MongoDB ObjectId

**Ответ:**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6789012345",
    "title": "Заголовок блока",
    "description": "Краткое описание",
    "content": "# Markdown контент",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

#### POST /api/content
Создать новый контентный блок

**Тело запроса:**
```json
{
  "title": "Заголовок блока",
  "description": "Краткое описание контента",
  "content": "# Markdown контент\n\nТекст в формате **markdown**",
  "isActive": true
}
```

**Валидация:**
- `title` - обязательно, строка 1-200 символов
- `description` - обязательно, строка 1-500 символов
- `content` - обязательно, строка (markdown)
- `isActive` - опционально, boolean (по умолчанию true)

**Ответ:**
```json
{
  "success": true,
  "message": "Контент успешно создан",
  "data": { ... }
}
```

#### PUT /api/content/:id
Обновить контентный блок

**Параметры:**
- `id` - MongoDB ObjectId

**Тело запроса:**
```json
{
  "title": "Обновленный заголовок",
  "description": "Обновленное описание",
  "content": "# Обновленный markdown",
  "isActive": false
}
```

Все поля опциональны, можно обновлять частично.

**Ответ:**
```json
{
  "success": true,
  "message": "Контент успешно обновлен",
  "data": { ... }
}
```

#### DELETE /api/content/:id
Удалить контентный блок

**Параметры:**
- `id` - MongoDB ObjectId

**Ответ:**
```json
{
  "success": true,
  "message": "Контент успешно удален",
  "data": { ... }
}
```

#### PATCH /api/content/:id/toggle
Переключить активность контентного блока

**Параметры:**
- `id` - MongoDB ObjectId

**Ответ:**
```json
{
  "success": true,
  "message": "Контент активирован",
  "data": { ... }
}
```

## Коды ошибок

- `400` - Неверные данные запроса
- `401` - Не авторизован
- `403` - Доступ запрещен (не супер администратор)
- `404` - Контент не найден
- `500` - Внутренняя ошибка сервера

## Примеры использования

### Создание контента
```bash
curl -X POST http://localhost:3000/api/content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Добро пожаловать",
    "description": "Приветственный блок для пользователей",
    "content": "# Добро пожаловать!\n\nЭто **главная** страница нашего сервиса."
  }'
```

### Получение активного контента
```bash
curl http://localhost:3000/api/content/active
```

### Обновление контента
```bash
curl -X PUT http://localhost:3000/api/content/64a1b2c3d4e5f6789012345 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Обновленный заголовок"
  }'
```

## Структура базы данных

Коллекция: `contents`

```javascript
{
  _id: ObjectId,
  title: String,        // максимум 200 символов
  description: String,  // максимум 500 символов
  content: String,      // markdown контент
  isActive: Boolean,    // активность блока
  createdAt: Date,      // дата создания
  updatedAt: Date       // дата обновления
}
```