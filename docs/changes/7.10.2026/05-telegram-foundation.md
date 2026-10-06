# Изменение: Telegram/backend foundation

Дата: 07.10.2026

## Изменено

- Создана Supabase Edge Function `telegram-webhook`.
- Добавлена проверка Telegram webhook secret.
- Реализовано преобразование входящего Telegram сообщения в Task.
- Task автоматически связывается с project `ai-sistem`.
- Coordinator назначается primary participant.
- Создаётся событие `task_created`.
- Добавлена документация Telegram foundation.

## Безопасность

- JWT Supabase для функции отключён только потому, что endpoint является Telegram webhook и использует отдельную проверку secret header.
- Bot Token и webhook secret не записываются в Git.
- Функция использует server-side Supabase credentials.
- Пользовательские сообщения не получают прямого доступа к таблицам Supabase.

## Проверка

Edge Function `telegram-webhook`: ACTIVE, version 1.

## Следующий этап

Подключить Telegram Bot Token и webhook, затем реализовать Coordinator orchestration и ответ пользователю.
