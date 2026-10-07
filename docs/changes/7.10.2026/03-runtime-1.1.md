# version 1.2

# Изменения — 07.10.2026

## 04:10 MSK

### Изменено
- docs/agent.md → 1.1
- docs/coordinator.md → 1.1
- supabase/functions/coordinator-worker/index.ts → 1.2
- supabase/functions/expert-worker/index.ts → 1.3
- supabase/functions/ai-provider-worker/index.ts → 1.3
- supabase/functions/result-aggregator/index.ts → 1.1

### Реализовано
- введён Context Packet версии 1.1;
- в runtime передаётся контекст платформы и проекта;
- эксперт получает собственные постоянные инструкции;
- инструкции загружаются только из разрешённого каталога docs/;
- добавлен запрет передачи инфраструктурных секретов в AI-контекст;
- экспертные результаты нормализуются в структурированный формат;
- Coordinator получает структурированные результаты экспертов;
- synthesis получает отдельный Coordinator Context;
- сохранена изоляция project context;
- существующая таблица agent_runs используется без изменения схемы.

### Причина
Устранить Runtime 1.0 ограничение, при котором AI получал только generic role/request и не имел постоянного контекста проекта и инструкции конкретного агента.

### Deployment
- coordinator-worker → ACTIVE v4
- expert-worker → ACTIVE v10
- ai-provider-worker → ACTIVE v7
- result-aggregator → ACTIVE v6
- Context instructions pinned to GitHub revision e586c9f4e691bf3f5eeb317ebcec3af38c718b94.

### Статус
Согласовано пользователем. Реализация и deployment выполнены. Требуется end-to-end тест через Telegram.


## Runtime 1.2 — 04:30 MSK

### Изменено
- docs/agent.md → 1.2
- supabase/functions/expert-worker/index.ts → 1.4
- supabase/functions/ai-provider-worker/index.ts → 1.4
- supabase/functions/result-aggregator/index.ts → 1.2
- supabase/migrations/20261007020000_create_project_repository_access.sql → 1.0

### Реализовано
- Project Repository Access с provider, repository, ref и allowlist путей;
- лимиты количества и размера evidence-файлов;
- Project Knowledge в Context Packet 1.2;
- controlled GitHub evidence для экспертов и Coordinator synthesis;
- repository content трактуется как недоверенные данные, а не runtime-инструкции.

### Статус
Согласовано пользователем. Реализация выполнена. Требуется deployment и end-to-end Telegram verification.
