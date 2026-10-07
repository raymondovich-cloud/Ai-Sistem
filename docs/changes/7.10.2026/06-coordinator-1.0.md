# version 1.0

# Изменение: Coordinator 1.0

Дата: 07.10.2026, Москва

## Изменено

- добавлен Edge Function `coordinator-worker`;
- Telegram webhook после создания task передаёт её Coordinator;
- Coordinator переводит task из `pending` в `consulting`;
- реализован детерминированный выбор релевантных экспертов;
- добавлено событие `coordination_started`;
- Coordinator и эксперты разделены по ролям: Coordinator управляет маршрутизацией, эксперты не вызываются без необходимости.

## Безопасность

Внутренний вызов Coordinator защищён серверным Authorization Bearer. Секреты не добавлены в GitHub.

## Статус

Реализация Coordinator 1.0 завершена. Требуется интеграционный тест через Telegram.
