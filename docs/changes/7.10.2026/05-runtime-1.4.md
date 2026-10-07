# version 1.1

# Изменения — 07.10.2026

## 09:49–10:00 MSK

### Runtime 1.4 — Observability & Runtime Evidence

### Изменено
- supabase/functions/telegram-webhook/index.ts → 1.3
- supabase/functions/coordinator-worker/index.ts → 1.4
- supabase/functions/expert-worker/index.ts → 1.6
- supabase/functions/ai-provider-worker/index.ts → 1.5
- supabase/functions/result-aggregator/index.ts → 1.4
- supabase/migrations/20261007040000_runtime_1_4_observability_retry.sql → 1.0
- supabase/schema.md → 1.2
- docs/agent.md → 1.4

### Реализовано
- runtime evidence из фактических task_events, agent_runs, task_finalizations и retry state;
- component registry с runtime/deployment version;
- access_granted и update_accepted trace events;
- routing_completed trace event;
- внутренний retry dispatcher;
- pg_cron каждую минуту;
- retry dispatch через защищённый внутренний токен;
- FOR UPDATE SKIP LOCKED и лимит 10 задач за тик;
- автоматическое восстановление retryable задач;
- coordinator принимает внутренний retry dispatch без раскрытия service-role ключа;
- audit/synthesis получает runtime evidence и может отделять code evidence от фактического runtime state.

### Безопасность
- runtime_internal_tokens не доступна anon/authenticated;
- функция runtime_retry_tick() закрыта для public/anon/authenticated;
- внутренний токен не передаётся в AI Context Packet;
- существующая Telegram webhook-аутентификация и allowlist сохранены;
- GitHub остаётся read-only для runtime evidence.

### Ограничение
Внешняя отправка Telegram по-прежнему не является exactly-once side effect: между Telegram API и фиксацией sent в БД существует crash window.

## Runtime 1.4.x — Runtime Trace Query hardening

### Изменено
- supabase/functions/coordinator-worker/index.ts → 1.5
- supabase/functions/result-aggregator/index.ts → 1.6
- docs/agent.md → 1.5

### Реализовано
- распознавание observability/runtime-trace запросов;
- запись observability-флага в routing trace;
- authoritative runtime-trace context;
- запрет использовать expert_results и project documentation как доказательство runtime execution для trace-запроса;
- подтверждение этапов только по task_events, agent_runs, task_finalizations и runtime state;
- обновлён runtime_component_versions после deployment.

### Проверка
- coordinator-worker deployed: Edge v16;
- result-aggregator deployed: Edge v25;
- runtime component registry синхронизирован;
- production schema не изменялась.

### Статус
Runtime Trace Query hardening реализован и deployed. Требуется финальный Telegram E2E тест именно с observability-запросом.
