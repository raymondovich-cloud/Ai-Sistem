# version 1.2

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


## 16. Runtime 1.4

### runtime_component_versions
Регистр текущих runtime-компонентов и их версий deployment.

Поля:
- component_key
- runtime_version
- edge_version
- status
- updated_at

### runtime_internal_tokens
Внутренние токены межсервисного runtime-диспетчера. Таблица backend-only, доступ anon/authenticated запрещён.

### runtime_retry_tick()
Backend scheduler function:
- выбирает retryable tasks с истёкшим next_retry_at;
- использует FOR UPDATE SKIP LOCKED;
- переводит задачу в pending;
- ставит асинхронный dispatch в coordinator-worker;
- фиксирует retry_dispatch_queued;
- ограничивает обработку 10 задачами за тик.

### pg_cron
Задача ai-sistem-retry-dispatch запускает runtime_retry_tick() каждую минуту.

Runtime evidence строится из task_events, agent_runs, task_finalizations и текущего состояния tasks.
