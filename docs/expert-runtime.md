# version 1.2

# Expert Runtime 1.2

Expert Runtime создаёт и запускает исполняемые единицы работы для выбранных консультантов.

После успешного завершения всех консультантов Expert Worker передаёт задачу в Result Aggregator. Если хотя бы один консультант завершился ошибкой, финальная агрегация не запускается.

## Поток

1. Coordinator переводит задачу в `consulting`.
2. Coordinator вызывает `expert-worker`.
3. Expert Worker получает консультантов из `task_participants`.
4. Для каждого нового консультанта создаётся `agent_runs` со статусом `queued`.
5. AI Provider выполняет каждый консультантский run.
6. Expert Worker проверяет, что все консультанты имеют статус `completed`.
7. При успехе вызывается `result-aggregator`.

Expert Worker остаётся runtime orchestration/dispatch слоем и не синтезирует ответы самостоятельно.
