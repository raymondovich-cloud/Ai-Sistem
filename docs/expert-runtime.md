# version 1.0

# Expert Runtime 1.0

## Назначение

Expert Runtime создаёт исполняемые единицы работы для выбранных консультантов.

Он не является LLM и не генерирует экспертное заключение самостоятельно.

## Поток

1. Coordinator переводит задачу в `consulting`.
2. Coordinator вызывает `expert-worker`.
3. Expert Worker получает консультантов из `task_participants`.
4. Для каждого консультанта создаётся `agent_runs` со статусом `queued`.
5. В `task_events` фиксируется `expert_consultations_queued`.
6. Следующий слой системы должен забрать queued run, вызвать выбранный AI provider и сохранить структурированный результат.

## Контракт agent_runs

- `queued` — ожидает исполнения.
- `running` — AI execution начат.
- `completed` — результат сохранён.
- `failed` — выполнение завершилось ошибкой.
- `cancelled` — выполнение отменено.

`input` содержит контекст задачи и идентификатор роли агента.

`output` зарезервирован под структурированный результат агента.

## Принцип

Expert Worker отвечает только за runtime orchestration.

AI provider, prompt policy, модель и формат экспертного ответа должны быть отдельным слоем.
