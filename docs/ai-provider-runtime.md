# version 1.0

# AI Provider Runtime 1.0

AI Provider Runtime выполняет один `agent_run` через подключённый AI-провайдер.

Первая реализация планируется через OpenAI Responses API. Provider изолирован отдельной Edge Function.

Secrets: `OPENAI_API_KEY`, опционально `OPENAI_MODEL` и `OPENAI_BASE_URL`. Ключ не хранится в GitHub, PostgreSQL или Telegram.

Контракт: `queued → running → completed`; ошибка: `running → failed`.

Результат сохраняется в `agent_runs.output`, события — в `task_events`.

Coordinator и Expert Worker не знают деталей API модели. Для другого провайдера создаётся отдельный adapter/runtime.
