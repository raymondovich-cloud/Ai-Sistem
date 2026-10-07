# version 1.1

# Expert Runtime 1.1

## Назначение

Expert Runtime создаёт и запускает исполняемые единицы работы для выбранных консультантов.

Он не является LLM и не генерирует экспертное заключение самостоятельно.

## Поток

1. Coordinator переводит задачу в `consulting`.
2. Coordinator вызывает `expert-worker`.
3. Expert Worker получает консультантов из `task_participants`.
4. Для каждого нового консультанта создаётся `agent_runs` со статусом `queued`.
5. В `task_events` фиксируется `expert_consultations_queued`.
6. Expert Worker получает созданные `run_id` и вызывает `ai-provider-worker` для каждого запуска.
7. В `task_events` фиксируется `expert_consultations_dispatched`.
8. AI Provider переводит запуск в `running`, выполняет AI-запрос и сохраняет результат в `agent_runs.output`.

## Контракт agent_runs

- `queued` — ожидает исполнения.
- `running` — AI execution начат.
- `completed` — результат сохранён.
- `failed` — выполнение завершилось ошибкой.
- `cancelled` — выполнение отменено.

`input` содержит контекст задачи и идентификатор роли агента.

`output` содержит результат AI provider после успешного исполнения.

## Диспетчеризация

Expert Worker не выполняет модель самостоятельно.

Для каждого нового `agent_run` он вызывает:

`POST /functions/v1/ai-provider-worker`

с телом:

`{ "run_id": "<uuid>" }`

Сервисная авторизация выполняется внутренним Supabase service-role credential. Значение credential не хранится в репозитории.

## Идемпотентность

Перед созданием запусков Expert Worker проверяет существующие `agent_runs` для задачи и не создаёт повторный запуск для уже присутствующего агента.

## Принцип

Expert Worker отвечает за runtime orchestration и dispatch.

AI provider, prompt policy, модель и формат экспертного ответа являются отдельным слоем.
