# version 1.1

# Telegram — Ai-Sistem

Telegram является интерфейсом управления Ai-Sistem.

## Полный lifecycle

Telegram → telegram-webhook → Task → Coordinator → Expert Worker → AI Provider → Result Aggregator → Final Coordinator → Telegram.

Webhook принимает входящие сообщения и создаёт Task. Он не содержит бизнес-логику маршрутизации или генерации ответа.

Result Aggregator отправляет финальный ответ через Telegram Bot API после успешного synthesis Coordinator.

## Secrets

`TELEGRAM_WEBHOOK_SECRET` защищает входящий webhook.
`TELEGRAM_BOT_TOKEN` используется только серверным Result Aggregator и не хранится в GitHub.

## Идемпотентность

Перед отправкой Result Aggregator проверяет наличие события `final_answer_sent` для задачи.
