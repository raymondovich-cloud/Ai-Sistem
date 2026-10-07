# version 1.0

insert into public.runtime_internal_tokens (key, token)
values ('telegram_diagnostic', gen_random_uuid()::text)
on conflict (key) do nothing;

create or replace function public.request_telegram_webhook_diagnostic()
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  internal_token text;
  request_id bigint;
begin
  select token into internal_token
  from public.runtime_internal_tokens
  where key = 'telegram_diagnostic'
  limit 1;

  if internal_token is null then
    raise exception 'telegram diagnostic token unavailable';
  end if;

  select net.http_post(
    url := 'https://poenmzpdeykvstlfyxgg.supabase.co/functions/v1/telegram-webhook-diagnostic',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ai-internal-token', internal_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.request_telegram_webhook_diagnostic() from public, anon, authenticated;
grant execute on function public.request_telegram_webhook_diagnostic() to postgres;

insert into public.runtime_component_versions (component_key, runtime_version, edge_version, status)
values ('telegram-webhook-diagnostic', '1.1', 2, 'active')
on conflict (component_key) do update
set runtime_version=excluded.runtime_version,
    edge_version=excluded.edge_version,
    status=excluded.status,
    updated_at=now();

-- Edge Function deployment is managed separately from SQL migrations.
-- The diagnostic function is deployed as telegram-webhook-diagnostic.
