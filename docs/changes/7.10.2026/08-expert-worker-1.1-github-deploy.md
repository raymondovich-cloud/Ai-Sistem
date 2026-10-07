# Изменение: Expert Worker 1.1 и GitHub deployment

**Дата:** 07.10.2026  
**Время:** 03:00+ MSK  
**Статус:** согласовано и реализовано

## Изменения

- `supabase/functions/expert-worker/index.ts` обновлён до версии 1.1.
- Expert Worker после создания `agent_runs` автоматически вызывает `ai-provider-worker`.
- Добавлено получение `run_id` после вставки запусков.
- Добавлена фиксация события `expert_consultations_dispatched`.
- Добавлена обработка результатов dispatch.
- Добавлен GitHub Actions workflow для деплоя только `expert-worker`.
- Workflow запускается вручную или при изменениях в `expert-worker` на `main`.

## Важное

Для GitHub Actions требуется секрет репозитория `SUPABASE_ACCESS_TOKEN`. Его значение не хранится в GitHub-коде и не передаётся в чат.

## Следующий шаг

После добавления `SUPABASE_ACCESS_TOKEN` в GitHub Secrets необходимо запустить workflow и проверить версию deployed Edge Function.
