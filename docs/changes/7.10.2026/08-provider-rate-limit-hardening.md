# version 1.0

# AI Provider 429 Rate-Limit Hardening

Дата: 07.10.2026, Москва

## Изменено

- `supabase/functions/ai-provider-worker/index.ts`
  - версия runtime: 1.8;
  - synthesis ограничен `max_output_tokens: 4000`;
  - expert-вызов ограничен `max_output_tokens: 3000`;
  - сохранена безопасная диагностика 429 и `Retry-After`.

- `supabase/functions/result-aggregator/index.ts`
  - версия runtime: 2.0;
  - provider 429 классифицируется отдельно;
  - `Retry-After` используется для расчёта следующего запуска;
  - вместо повторных попыток каждые 30 секунд задача ожидает указанный provider interval (максимум 7 дней);
  - runtime event `provider_rate_limit_scheduled` фиксирует причину и запланированную задержку.

- `supabase/migrations/20261007112000_provider_rate_limit_hardening.sql`
  - runtime registry обновлён до ai-provider-worker 1.8 / Edge 20;
  - result-aggregator 2.0 / Edge 35.

## Проверка

- ai-provider-worker успешно задеплоен как Edge v20.
- result-aggregator успешно задеплоен как Edge v35.
- migration применена успешно.

## Причина

TEST 003 подтвердил реальный OpenAI `rate_limit_exceeded` по TPM:
100000 TPM, использовано 98617, запрошено 26074, Retry-After около 7.4 суток.

## Статус

Изменение согласовано пользователем и выполнено.

## Следующий шаг

Провести TEST 004 после применения provider limit policy. Для полного E2E успеха OpenAI должен принять synthesis-запрос; если provider interval ещё активен, задача должна корректно перейти в отложенный retry без retry-loop.
