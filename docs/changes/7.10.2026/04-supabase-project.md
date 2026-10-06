# Изменение: Supabase foundation

Дата: 07.10.2026

## Изменено

- Создан отдельный Supabase-проект Ai-Sistem.
- Регион: eu-west-1.
- Создана первая миграция foundation schema.
- Добавлены 14 системных таблиц: projects, agents, tasks, task_participants, task_events, decisions, approvals, project_memory, agent_memory, documents, sources, integrations, permissions, audit_logs.
- Для всех системных таблиц включён RLS.
- Доступ anon/authenticated к системным таблицам закрыт на уровне grants.
- Добавлены начальный проект Ai-Sistem и 9 зарегистрированных AI-ролей.
- Добавлены индексы для основных связей и workflow-запросов.

## Проверка

- Supabase project status: ACTIVE_HEALTHY.
- projects: 1.
- agents: 9.
- foundation tables: 14.
- tasks: 0.
- audit_logs: 0.

## Следующий этап

Подключение Telegram/backend слоя и реализация task orchestration поверх созданного foundation.
