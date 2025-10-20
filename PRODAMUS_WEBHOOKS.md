# Prodamus Webhooks - Улучшенная обработка

## Обзор

Улучшенные webhook'и для обработки платежей через Prodamus с автоматическим сохранением в БД и уведомлениями пользователей.

## 🎯 Универсальный Webhook (Рекомендуется)

### Endpoint: `/api/prodamus/webhook`
**Метод:** POST

Единый универсальный endpoint для обработки **всех типов платежей** от Prodamus. Автоматически определяет тип платежа (подписка или разовый платеж) и обрабатывает соответствующим образом.

#### Преимущества:
✅ **Один endpoint для всех платежей** - упрощает настройку в Prodamus  
✅ **Автоматическое определение типа** - по структуре данных  
✅ **Единая обработка ошибок** - консистентное поведение  
✅ **Детальное логирование** - отслеживание каждого этапа

#### Как работает:

1. **Получает данные от Prodamus**
2. **Определяет тип платежа:**
   - Если есть поле `subscription[id]` → **Подписка**
   - Если есть поля `_param_user` и `_param_customer_id` → **Разовый платеж за расклад**
3. **Вызывает соответствующую логику обработки**

#### Пример использования в Prodamus:
```
Webhook URL: https://your-domain.com/api/prodamus/webhook
```

---

## Webhooks (Устаревшие, оставлены для совместимости)

### 1. Webhook подписок

**Endpoint:** `/api/prodamus/webhook/subscription` *(deprecated)*  
**Метод:** POST

#### Что обрабатывает:
- Оплату подписок Basic и Pro
- Активацию/деактивацию подписок
- Продление подписок

#### Новые возможности:
✅ **Сохранение в БД** - все успешные платежи сохраняются в коллекции `Payments`
✅ **Уведомления в Telegram** - пользователь получает красивое сообщение при активации
✅ **Улучшенное логирование** - детальные логи на каждом этапе
✅ **Обработка ошибок** - graceful handling с продолжением работы

#### Формат данных от Prodamus:
```json
{
  "customer_extra": "customerId",
  "payment_status": "success",
  "order_num": "12345",
  "sum": "990",
  "subscription[id]": "2473695",
  "subscription[active_user]": "1",
  "subscription[date_next_payment]": "2025-11-04 12:00:00"
}
```

#### Уведомление пользователю:
```
🎉 Подписка успешно оформлена!

✅ Тариф: PRO 🌟
📅 Действует до: 04.11.2025

Теперь у тебя есть доступ ко всем функциям бота:
• Безлимитные расклады Таро 🔮
• Все астрологические гороскопы 🌟
• Приоритетная поддержка 💬

Используй /menu для доступа ко всем функциям!
```

#### Сохраняемые данные:
```javascript
{
  amount: 990,
  bot_name: "customer_username",
  username: "customer_username",
  type: "subscription_pro", // или "subscription_basic"
  createdAt: Date
}
```

---

### 2. Webhook разовых платежей (`handleTarotPaymentWebhook`)

**Endpoint:** `/api/prodamus/webhook/tarot-payment`  
**Метод:** POST

#### Что обрабатывает:
- Разовые платежи за расклады Таро (100₽)
- Генерацию и отправку AI расклада

#### Новые возможности:
✅ **Сохранение в БД** - платежи сохраняются с типом `tarot_reading`
✅ **Метаданные пользователя** - сохраняются дата и сумма последнего платежа
✅ **Умная обработка ошибок** - уведомление пользователя при проблемах
✅ **Детальный ответ** - возвращает полную информацию о транзакции

#### Формат данных от Prodamus:
```json
{
  "_param_user": "telegram_chat_id",
  "_param_customer_id": "customerId",
  "_param_bot": "prorok",
  "payment_status": "success",
  "order_num": "12345",
  "sum": "100",
  "customer_email": "user@example.com",
  "customer_phone": "+79991234567"
}
```

#### Обновление пользователя:
```javascript
{
  state: "paid_waiting_question",
  lastPaymentDate: new Date(),
  lastPaymentAmount: 100
}
```

#### Сохраняемые данные:
```javascript
{
  amount: 100,
  bot_name: "customer_username",
  username: "telegram_chat_id",
  type: "tarot_reading",
  createdAt: Date
}
```

---

## Обработка ошибок

### Webhook подписок:
1. Если не найден customer → 404 error
2. Если ошибка сохранения платежа → логируется, но процесс продолжается
3. Если ошибка отправки уведомления → логируется, но статус обновляется
4. Общие ошибки → 500 с детальным описанием

### Webhook платежей:
1. Если не найден user или customer → 404 error
2. Если ошибка генерации расклада → уведомление пользователю + 500 error
3. Если ошибка сохранения → логируется, но расклад отправляется
4. Критические ошибки → попытка уведомить пользователя + 500 error

---

## Логирование

### Уровни логирования:

**📩 Info** - входящий webhook
```
📩 Prodamus subscription webhook: {...}
```

**📝 Details** - детали транзакции
```
📝 Subscription details: customerId=xxx, status=success, amount=990
```

**✅ Success** - успешные операции
```
✅ Payment saved to database: 990 RUB
✅ Customer subscription updated
✅ Subscription notification sent
```

**⚠️ Warning** - предупреждения
```
⚠️ Payment not successful: pending
```

**❌ Error** - ошибки
```
❌ Error saving payment: ...
❌ Customer not found: xxx
```

---

## База данных

### Коллекция Payments

```typescript
interface IPayment {
  amount: number;        // Сумма платежа
  bot_name: string;      // Имя бота/клиента
  username: string;      // Username пользователя
  type: string;          // Тип: "subscription_basic" | "subscription_pro" | "tarot_reading"
  createdAt: Date;       // Дата создания
}
```

### Типы платежей:
- `subscription_basic` - Подписка Basic
- `subscription_pro` - Подписка Pro
- `tarot_reading` - Разовый расклад Таро

---

## Тестирование

### Тест webhook подписки:
```bash
curl -X POST http://localhost:3000/api/prodamus/subscription \
  -H "Content-Type: application/json" \
  -d '{
    "customer_extra": "customer_id_here",
    "payment_status": "success",
    "subscription[id]": "2473695",
    "subscription[active_user]": "1",
    "subscription[date_next_payment]": "2025-11-04 12:00:00",
    "sum": "990",
    "order_num": "TEST123"
  }'
```

### Тест webhook платежа:
```bash
curl -X POST http://localhost:3000/api/prodamus/tarot \
  -H "Content-Type: application/json" \
  -d '{
    "_param_user": "telegram_chat_id",
    "_param_customer_id": "customer_id_here",
    "_param_bot": "prorok",
    "payment_status": "success",
    "order_num": "TEST456",
    "sum": "100"
  }'
```

---

## Безопасность

### Рекомендации:
1. ✅ Валидация всех входящих параметров
2. ✅ Проверка статуса платежа перед обработкой
3. ✅ Graceful error handling без прерывания процесса
4. ✅ Детальное логирование для аудита
5. ⚠️ TODO: Добавить проверку подписи от Prodamus
6. ⚠️ TODO: Добавить rate limiting для webhook endpoints

---

## Monitoring

### Метрики для отслеживания:
- Количество успешных/неуспешных платежей
- Среднее время обработки webhook
- Количество ошибок при генерации расклада
- Количество неотправленных уведомлений

### Алерты:
- ❌ Более 3 ошибок подряд при обработке webhook
- ⚠️ Время обработки > 5 секунд
- ⚠️ Неотправленные уведомления > 10%

