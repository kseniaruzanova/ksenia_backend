# API управления контентом

Система для управления контентом, привязанным к продуктам. Позволяет создавать, редактировать и управлять контентными блоками (скриптами продаж) для различных продуктов, таких как "тароскоп".

## Эндпоинты

### Публичные эндпоинты

#### GET /api/content/active
Получить активный контент для конкретного продукта (доступно без аутентификации).

**Query параметры:**
- `productType` (string, required) - Тип продукта (например, `forecast`).
- `productId` (string, required) - Уникальный идентификатор продукта (например, `taroscope-main`).

**Пример запроса:**
```
GET /api/content/active?productType=forecast&productId=taroscope-main
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6789012345",
    "productType": "forecast",
    "productId": "taroscope-main",
    "title": "Заголовок для Тароскопа",
    "description": "Описание для Тароскопа",
    "content": "# Markdown контент\n\nСкрипт продаж для тароскопа.",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

### Защищенные эндпоинты (только для супер администратора)

Все следующие эндпоинты требуют заголовок: `Authorization: Bearer <JWT_TOKEN>`

#### GET /api/content
Получить все контентные блоки с пагинацией и фильтрацией.

**Query параметры:**
- `page` (number, optional) - номер страницы (по умолчанию: 1)
- `limit` (number, optional) - количество элементов на странице (по умолчанию: 10)
- `isActive` (boolean, optional) - фильтр по активности
- `productType` (string, optional) - фильтр по типу продукта
- `productId` (string, optional) - фильтр по ID продукта

**Пример запроса:**
```
GET /api/content?page=1&limit=5&productType=forecast
```

#### GET /api/content/:id
Получить контентный блок по ID.

#### POST /api/content
Создать новый контентный блок.

**Тело запроса:**
```json
{
  "productType": "forecast",
  "productId": "taroscope-main",
  "title": "Новый скрипт продаж",
  "description": "Описание нового скрипта",
  "content": "# Markdown контент",
  "isActive": true
}
```

**Валидация:**
- `productType` - обязательно, строка
- `productId` - обязательно, строка
- `title` - обязательно, строка 1-200 символов
- `description` - обязательно, строка 1-500 символов
- `content` - обязательно, строка (markdown)
- `isActive` - опционально, boolean (по умолчанию true)

#### PUT /api/content/:id
Обновить контентный блок. Все поля в теле запроса опциональны.

#### DELETE /api/content/:id
Удалить контентный блок.

#### PATCH /api/content/:id/toggle
Переключить активность контентного блока.

## Структура базы данных

Коллекция: `contents`

```javascript
{
  _id: ObjectId,
  productType: String,  // Тип продукта (например, 'forecast')
  productId: String,    // ID продукта (например, 'taroscope-main')
  title: String,        // максимум 200 символов
  description: String,  // максимум 500 символов
  content: String,      // markdown контент
  isActive: Boolean,    // активность блока
  createdAt: Date,
  updatedAt: Date
}
```