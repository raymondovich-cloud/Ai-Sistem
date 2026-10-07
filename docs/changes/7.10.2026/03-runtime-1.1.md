# version 1.0

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

### Статус
Согласовано пользователем. Реализация выполнена; требуется deployment и end-to-end verification.
