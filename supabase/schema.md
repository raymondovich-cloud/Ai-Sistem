# version 1.0

# Ai-Sistem — модель данных v1

## 1. projects

Регистр всех продуктов, которыми управляет Ai-Sistem.

Основные поля:
- id
- name
- slug
- description
- status
- repository_reference
- created_at
- updated_at

## 2. agents

Регистр AI-агентов системы.

Основные поля:
- id
- key
- name
- role
- instruction_path
- status
- configuration
- created_at
- updated_at

Один агент является Coordinator.

## 3. tasks

Центральная сущность workflow.

Основные поля:
- id
- project_id
- created_by
- title
- request
- status
- priority
- primary_agent_id
- parent_task_id
- created_at
- updated_at
- completed_at

## 4. task_participants

Связывает задачу с участвующими агентами.

Основные поля:
- task_id
- agent_id
- participation_type
- status
- assigned_at
- completed_at

Типы участия:
- coordinator
- primary
- consultant
- reviewer
- observer

## 5. task_events

Хронологический журнал событий задачи.

Примеры:
- task_created
- agent_assigned
- consultation_requested
- decision_created
- implementation_started
- implementation_completed
- verification_started
- verification_completed
- task_blocked
- task_completed

## 6. decisions

Структурированные экспертные решения.

Основные поля:
- id
- task_id
- agent_id
- decision_type
- conclusion
- rationale
- confidence
- evidence
- created_at

## 7. approvals

Фиксирует согласование решений или реализации.

Основные поля:
- id
- task_id
- decision_id
- agent_id
- status
- comment
- created_at

## 8. project_memory

Долгоживущая память конкретного проекта.

Примеры:
- архитектурные решения;
- утверждённые UX-правила;
- ограничения;
- важные факты;
- технические решения.

Память всегда принадлежит project_id.

## 9. agent_memory

Внутренняя память агента.

Она не должна автоматически становиться общей памятью проекта.

Если знание должно стать проектным фактом, оно переносится через контролируемый workflow.

## 10. documents

Метаданные документов и артефактов, используемых системой.

Сами большие файлы не обязаны храниться в PostgreSQL.

## 11. sources

Источники внешней информации.

Нужны для сохранения происхождения утверждений и результатов исследований.

## 12. integrations

Связи Ai-Sistem с внешними системами.

Примеры:
- GitHub;
- LifeGame API;
- Telegram;
- другие продукты.

Секреты интеграций в таблице не хранятся в открытом виде.

## 13. permissions

Разрешения Ai-Sistem на действия в конкретном project/integration.

Принцип: least privilege.

## 14. audit_logs

Неизменяемый по смыслу журнал критических действий.

Фиксирует:
- кто;
- что;
- над каким объектом;
- когда;
- результат;
- metadata.

## Связи

project
  ├── tasks
  ├── project_memory
  ├── documents
  ├── integrations
  └── permissions

task
  ├── task_participants
  ├── task_events
  ├── decisions
  └── approvals

agent
  ├── task_participants
  ├── decisions
  └── agent_memory

## Принцип доступа

Нельзя строить авторизацию только на факте authenticated.

Доступ должен определяться ролью и принадлежностью объекта к разрешённому project.

RLS является обязательным защитным слоем для exposed tables.
