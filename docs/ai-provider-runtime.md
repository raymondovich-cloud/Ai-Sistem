# version 1.2

# AI Provider Runtime 1.2

AI Provider выполняет один `agent_run` через OpenAI Responses API.

Для обычного экспертного запуска используется режим `expert`. Для финального Coordinator используется режим `synthesis`: Provider получает только результаты завершённых консультантов из доверенной БД и формирует единый пользовательский ответ.

Секреты: `OPENAI_API_KEY`, опционально `OPENAI_MODEL` и `OPENAI_BASE_URL`. Секреты не хранятся в GitHub.

Результат сохраняется в `agent_runs.output`, события — в `task_events`.

Provider не загружает произвольные instruction-файлы из GitHub и не получает внешние URL от пользователя.
