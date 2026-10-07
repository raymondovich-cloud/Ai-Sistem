# version 1.0

# Изменения — 07.10.2026

## 05:00–05:15 MSK

### Runtime 1.3 — Reliable & Secure Execution

### Изменено

- supabase/functions/telegram-webhook/index.ts → 1.2
- supabase/functions/coordinator-worker/index.ts → 1.3
- supabase/functions/expert-worker/index.ts → 1.5
- supabase/functions/result-aggregator/index.ts → 1.3
- docs/agent.md → 1.3
- supabase/migrations/20261007030000_runtime_1_3_reliability_security.sql → 1.0
- supabase/migrations/20261007030100_runtime_1_3_agent_run_attempts.sql → 1.0

### Реализовано

- Telegram update idempotency через уникальный telegram_update_id;
- allowlist Telegram-доступа с ролями owner/admin/operator;
- отказ неизвестным пользователям до создания task;
- retryable/failed состояния задач;
- retry_count и max_attempts;
- execution attempts для agent_runs;
- повторный запуск только для failed execution с ограничением попыток;
- atomic/lease-based finalization claim;
- защита от параллельного запуска result-aggregator;
- фиксация finalization sent/failed;
- расширенная execution trace через task_events;
- сохранение разделения retryable и permanent ошибок;
- отсутствие передачи секретов в AI context.

### Ограничение

Отправка сообщения через Telegram является внешним side effect. База данных не может атомарно объединить запись состояния и внешний Telegram API call. Поэтому после успешной отправки и аварии до фиксации sent возможна повторная доставка после истечения lease.

### Security

- telegram_access, telegram_updates и task_finalizations защищены RLS;
- anon/authenticated не имеют доступа к новым runtime-таблицам;
- сервисный runtime остаётся единственным доверенным исполнителем.

### Статус

Реализация Runtime 1.3 выполнена. Требуется deployment всех изменённых Edge Functions, end-to-end verification и security/performance verification.


### Deployment

- telegram-webhook → ACTIVE v10
- coordinator-worker → ACTIVE v9
- expert-worker → ACTIVE v17
- result-aggregator → ACTIVE v14
- all Runtime 1.3 changed Edge Functions deployed successfully.

### Verification

- Runtime 1.3 schema present in Supabase;
- Telegram access allowlist contains the authorized owner entry;
- new retry/finalization columns and execution-attempt column verified;
- Supabase Security Advisor: only existing INFO-level RLS-without-policy findings; no new critical security finding;
- Supabase Performance Advisor: INFO-level existing/unindexed-FK/unused-index notices, no blocking finding;
- end-to-end Telegram test remains required.
