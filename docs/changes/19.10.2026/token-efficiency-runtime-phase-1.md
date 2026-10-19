# Token efficiency runtime phase 1

**Дата:** 19.10.2026  
**Ветка:** `runtime/token-efficiency-metrics-context`  
**База:** `docs/token-efficiency-standard`  
**Статус:** код подготовлен в отдельной ветке; production не развёрнут.

## Цель

Начать реализацию стандарта token efficiency с двух базовых возможностей: фиксировать provider usage и ограничивать чрезмерный контекст до отправки запроса.

## Изменения

### `supabase/functions/ai-provider-worker/index.ts`

- Сохраняет provider-reported usage Responses API в `agent_runs.output.token_usage`: входные, выходные и общие токены, а также cached/reasoning tokens, когда они доступны.
- Пишет usage и метрики контекста в `task_events.payload`.
- Сохраняет размер подготовленного контекста, оценку токенов по UTF-8 bytes/3 и длительность запроса. Оценка явно помечена как эвристика, а не фактическое usage.
- Добавляет preflight guard `AI_PROVIDER_MAX_INPUT_BYTES`, по умолчанию 48 000 bytes. При превышении API не вызывается; событие `provider_context_budget_exceeded` содержит метрики превышения.

### `supabase/functions/expert-worker/index.ts`

- Ограничивает repository evidence по умолчанию до 12 000 bytes на файл и 30 000 bytes суммарно.
- Добавляет конфигурацию `AI_EVIDENCE_MAX_FILE_BYTES` и `AI_EVIDENCE_MAX_TOTAL_BYTES`.
- При превышении лимита файла сохраняет начало и конец текста с явной отметкой truncation; последующие файлы пропускаются после исчерпания общего бюджета.
- Сохраняет метрики evidence в input запуска и событиях.
- При provider context-budget error помечает задачу как failed/permanent вместо повторного вызова с тем же неизменённым контекстом.

### `supabase/functions/result-aggregator/index.ts`

- Уменьшает объём полей в каждом экспертном результате и repository evidence, передаваемых в synthesis.
- Превышение synthesis context budget фиксируется как permanent failure, без бессмысленных повторных provider-вызовов.

### `docs/agent.md`

- Версия документа повышена до 1.11.
- Зафиксированы метрики, лимиты, конфигурация и границы первой runtime-фазы.

## Проверки и ограничения

- Изменения выполнялись только в feature-ветке; основная ветка и production Edge Functions не изменялись.
- Миграция БД не добавлялась: usage сохраняется в существующих JSONB-полях `agent_runs.output` и `task_events.payload`.
- Выполнена статическая проверка затронутых фрагментов и последовательности изменений через GitHub API.
- Полноценный Deno type-check, интеграционные тесты и проверка качества ответов на реальных задачах в этой среде не запускались.
- Перед deploy нужно проверить поведение слишком больших задач в тестовом окружении, включая пользовательское уведомление о permanent failure.
- Task-level cumulative token budget и глобальный TPM/RPM/concurrency dispatcher остаются следующими отдельными этапами.
