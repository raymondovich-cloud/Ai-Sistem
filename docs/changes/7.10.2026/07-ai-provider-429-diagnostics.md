# version 1.0

# Изменения — 07.10.2026

## 07:50–07:55 MSK

### AI Provider 429 Diagnostics

### Изменено
- `supabase/functions/ai-provider-worker/index.ts` → version 1.7;
- runtime registry: `ai-provider-worker` → runtime 1.7 / Edge 18;
- безопасная диагностика HTTP 429 от OpenAI.

### Реализовано
- чтение `error.code` и `error.type` из ответа провайдера;
- сохранение ограниченного текста `error.message` без секретов;
- фиксация `Retry-After`, если заголовок присутствует;
- классификация 429 как rate-limit/quota вместо общего `provider_http_429`;
- API key и другие секреты не сохраняются в runtime evidence.

### Причина
Предыдущая реализация теряла тело ошибки OpenAI и сохраняла только HTTP 429, поэтому невозможно было отличить временный rate limit от quota/credit/spend limit.

### Проверка
- `ai-provider-worker` успешно развёрнут: Edge v18;
- runtime registry подтверждает runtime 1.7 / Edge 18;
- текущая задача `849fb6c8-0125-4a65-b3a1-ea7f13fd92a6` ранее получила повторный `provider_http_429`.

### Статус
Диагностический слой готов. Следующий provider-вызов должен дать точную категорию причины 429.

### Approval
Изменение выполнено после согласования пользователя.
