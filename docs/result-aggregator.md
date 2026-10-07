# version 1.0

# Result Aggregator 1.0

Result Aggregator завершает текущий Telegram lifecycle задачи.

## Ответственность

1. Проверить, что все консультанты завершены успешно.
2. Собрать их результаты из `agent_runs.output`.
3. Создать отдельный `agent_run` для Coordinator в режиме `synthesis`.
4. Передать его в AI Provider.
5. Получить финальный пользовательский ответ.
6. Отправить ответ в Telegram через `TELEGRAM_BOT_TOKEN`.
7. Перевести Task в `completed`.
8. Записать `final_answer_sent`.

Telegram остаётся транспортным интерфейсом. Бизнес-логика агрегации находится в отдельной Edge Function.

## Безопасность

- доступ только по Supabase service-role authorization;
- Telegram token только в Supabase Secrets;
- в synthesis передаются только результаты завершённых консультантских runs;
- повторная отправка защищена проверкой `final_answer_sent`;
- ответ разбивается на сообщения до 4000 символов;
- пользовательские данные не выводятся в логи функции.
