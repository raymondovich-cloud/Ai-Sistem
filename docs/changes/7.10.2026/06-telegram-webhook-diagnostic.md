# version 1.5

# Изменения — 07.10.2026

## 10:34–10:36 MSK

### Telegram Webhook Diagnostic

### Изменено
- новая Edge Function: `supabase/functions/telegram-webhook-diagnostic/index.ts` → 1.2;
- новая Edge Function config: `supabase/functions/telegram-webhook-diagnostic/deno.json` → 1.0;
- новая migration: `supabase/migrations/20261007103400_telegram_webhook_diagnostic.sql`;
- runtime registry: `telegram-webhook-diagnostic` → runtime 1.1 / Edge 3.

### Реализовано
- серверная диагностика Telegram Bot API через `getWebhookInfo` без раскрытия bot token;
- проверка `getMe` для определения режима работы бота;
- отдельный внутренний токен `telegram_diagnostic`;
- доступ к диагностике закрыт для public/anon/authenticated;
- диагностический endpoint возвращает только безопасные поля webhook и bot capabilities.

### Фактическая диагностика
- webhook URL корректный: `/functions/v1/telegram-webhook`;
- `pending_update_count = 0`;
- `last_error_date = null`;
- `last_error_message = null`;
- Telegram не фиксирует ошибок доставки webhook;
- `can_read_all_group_messages = false`.

### Вывод
Проблема с `TEST 001` подтверждена как Telegram Privacy Mode в групповой переписке. Webhook и Supabase runtime исправны; обычные сообщения группы не передаются боту при текущем режиме.

### Следующее действие
В BotFather для Ai-Sistem bot необходимо отключить Privacy Mode через `/setprivacy` → `Disable`. После этого выполнить новый E2E тест обычным сообщением в группе.
