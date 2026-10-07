# version 1.1

# Ai-Sistem — модель данных v1.1

К базовой модели workflow добавлена сущность `agent_runs`.

## 15. agent_runs

Исполняемый запуск конкретного агента в рамках задачи.

Основные поля:

- id
- task_id
- agent_id
- status
- input
- output
- error
- created_at
- started_at
- completed_at
- updated_at

Жизненный цикл:

`queued → running → completed`

При ошибке:

`running → failed`

При отмене:

`queued/running → cancelled`

Один `agent_runs` соответствует одной паре `task_id + agent_id`.

## Связь workflow

`tasks`
→ `task_participants`
→ `agent_runs`
→ AI Provider
→ экспертный результат
→ `decisions` / `task_events`

Expert Runtime не содержит бизнес-логику конкретного эксперта и не выбирает AI-модель.
