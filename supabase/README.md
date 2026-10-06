# version 1.0

# Ai-Sistem Supabase

Этот каталог содержит инфраструктуру базы данных отдельного Supabase-проекта Ai-Sistem.

## Принцип

Supabase Ai-Sistem хранит данные самой AI Development System.

Данные LifeGame и других подключаемых продуктов находятся в их собственных системах и не переносятся сюда.

## Предполагаемая модель

- projects — подключённые продукты;
- agents — определения AI-агентов;
- tasks — задачи;
- task_participants — участники workflow;
- task_events — события выполнения;
- decisions — экспертные решения;
- approvals — согласования;
- project_memory — память проекта;
- agent_memory — память агента;
- documents — документы и артефакты;
- sources — внешние источники;
- integrations — подключённые внешние системы;
- permissions — разрешения;
- audit_logs — журнал действий.

## Миграции

Схема должна управляться version-controlled migrations.

После создания отдельного Supabase-проекта Ai-Sistem локальная структура будет инициализирована через Supabase CLI и привязана к remote project. Изменения схемы будут проходить через миграции, а не через произвольные изменения production database.

## Безопасность

Все таблицы, доступные через exposed schema, должны иметь RLS с политиками, соответствующими фактической модели доступа.

Секреты и service-role credentials не хранятся в Git.
