# version 1.0

# Telegram — Ai-Sistem foundation

## Назначение

Telegram является первым интерфейсом управления Ai-Sistem.

Поток первого этапа:

Telegram → telegram-webhook → Supabase → Task → Coordinator.

Telegram не содержит бизнес-логику маршрутизации и не обращается напрямую к таблицам системы.

## Webhook

Реализована Supabase Edge Function:

- имя: `telegram-webhook`;
- JWT Supabase отключён, потому что Telegram использует собственную аутентификацию webhook;
- запрос принимается только при совпадении заголовка `X-Telegram-Bot-Api-Secret-Token` с секретом `TELEGRAM_WEBHOOK_SECRET`;
- bot token не хранится в Git.

## Что делает webhook

1. Проверяет HTTP method.
2. Проверяет наличие webhook secret.
3. Проверяет Telegram secret header.
4. Извлекает текст сообщения.
5. Находит project `ai-sistem`.
6. Создаёт Task со статусом `pending`.
7. Назначает Coordinator primary participant.
8. Создаёт событие `task_created`.
9. Возвращает `task_id`.

## Что пока не подключено

- Telegram Bot Token;
- установка Telegram webhook URL;
- отправка ответов обратно в Telegram;
- LLM Coordinator;
- автоматический выбор специализированных экспертов;
- выполнение задач разработчиком;
- визуальные identity/avatars агентов.

Это намеренно следующий слой. Foundation не должен смешивать Telegram transport, orchestration и LLM logic в одном компоненте.
