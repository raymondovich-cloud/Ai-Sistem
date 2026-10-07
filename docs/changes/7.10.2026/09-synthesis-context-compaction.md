# version 1.0

# Изменение: компактный synthesis-контекст

Дата: 07.10.2026 (МСК)

## Изменённые файлы

- supabase/functions/result-aggregator/index.ts

## Что изменено

- Добавлено компактирование project knowledge перед synthesis.
- Ограничен объём содержимого отдельных repository evidence.
- Ограничены и компактированы expert results.
- Для обычного synthesis больше не передаётся дублирующий runtime_trace; он сохраняется только для явных runtime-trace запросов.
- Runtime evidence ограничен последними релевантными событиями, запусками и активными компонентами.
- Runtime trace для observability-запросов остаётся авторитетным и не сокращается.

## Цель

Снизить входной token-потребление synthesis и вероятность TPM 429 без потери критичной runtime-доказательной информации.

## Результат

result-aggregator развёрнут как Edge Function v39, runtime marker 2.1.

## Статус

Согласовано пользователем и реализовано.
