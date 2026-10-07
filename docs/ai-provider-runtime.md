# version 1.1

# AI Provider Runtime 1.1

AI Provider Runtime выполняет один `agent_run` через подключённый AI-провайдер.

Первая реализация использует OpenAI Responses API. Provider изолирован отдельной Edge Function.

Secrets: `OPENAI_API_KEY`, опционально `OPENAI_MODEL` и `OPENAI_BASE_URL`. Ключ не хранится в GitHub, PostgreSQL или Telegram.

Контракт: `queued → running → completed`; ошибка: `running → failed`.

Результат сохраняется в `agent_runs.output`, события — в `task_events`.

Coordinator и Expert Worker не знают деталей API модели. Для другого провайдера создаётся отдельный adapter/runtime.

## Исправление 1.1

Извлечение текста из Responses API больше не зависит только от корневого `output_text`. Runtime сначала использует `output_text`, затем безопасно собирает текстовые части из `output[].content[].text`.

Это предотвращает ложный `provider_empty_output` при валидном ответе провайдера с другой формой представления текста.
