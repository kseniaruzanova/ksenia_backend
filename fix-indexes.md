# Исправление индексов в коллекции Users

## Проблема
В базе данных есть старый индекс только по `chat_id`, который блокирует создание пользователей с одинаковым `chat_id` для разных кастомеров.

## Решение 1: Автоматический скрипт

```bash
# Запустить скрипт для автоматического исправления
node fix-indexes.js
```

## Решение 2: MongoDB Shell команды

```bash
# Подключиться к MongoDB
mongo "mongodb://localhost:27017/myAppDB"
# или
mongosh "mongodb://localhost:27017/myAppDB"
```

```javascript
// Посмотреть текущие индексы
db.Users.getIndexes()

// Удалить проблемный индекс (если существует)
db.Users.dropIndex("chat_id_1")

// Создать правильный составной индекс
db.Users.createIndex(
    { "chat_id": 1, "customerId": 1 }, 
    { "unique": true, "name": "chat_id_1_customerId_1" }
)

// Проверить результат
db.Users.getIndexes()
```

## Решение 3: Через MongoDB Compass

1. Откройте MongoDB Compass
2. Перейдите в коллекцию `Users`
3. На вкладке "Indexes" найдите индекс `chat_id_1`
4. Удалите его
5. Создайте новый индекс:
   - Fields: `{ "chat_id": 1, "customerId": 1 }`
   - Options: `{ "unique": true }`

## Ожидаемый результат

После исправления должны быть индексы:
- `_id_` (по умолчанию)
- `chat_id_1_customerId_1` (составной, уникальный)

Теперь один пользователь сможет принадлежать разным кастомерам! 