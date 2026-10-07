-- version 1.0
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.runtime_component_versions (
  id uuid primary key default gen_random_uuid(),
  component_key text not null unique,
  runtime_version text not null,
  edge_version integer,
  status text not null default 'active' check (status in ('active','inactive')),
  updated_at timestamptz not null default now()
);

alter table public.runtime_component_versions enable row level security;
revoke all on table public.runtime_component_versions from anon, authenticated;

insert into public.runtime_component_versions (component_key, runtime_version, edge_version)
values
  ('telegram-webhook', '1.4', null),
  ('coordinator-worker', '1.4', null),
  ('expert-worker', '1.4', null),
  ('ai-provider-worker', '1.4', null),
  ('result-aggregator', '1.4', null)
on conflict (component_key) do update
set runtime_version = excluded.runtime_version,
    status = 'active',
    updated_at = now();

create table if not exists public.runtime_internal_tokens (
  key text primary key,
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.runtime_internal_tokens enable row level security;
revoke all on table public.runtime_internal_tokens from anon, authenticated;

insert into public.runtime_internal_tokens (key, token)
values ('retry_dispatch', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create index if not exists runtime_internal_tokens_key_idx
  on public.runtime_internal_tokens (key);

create or replace function public.runtime_retry_tick()
returns integer
language plpgsql
security definer
set search_path = public, extensions, net
as $fn$
declare
  selected_task record;
  dispatched integer := 0;
  internal_token text;
begin
  select token into internal_token
  from public.runtime_internal_tokens
  where key = 'retry_dispatch';

  if internal_token is null then
    raise exception 'retry_dispatch_token_missing';
  end if;

  for selected_task in
    select id
    from public.tasks
    where status = 'retryable'
      and next_retry_at is not null
      and next_retry_at <= now()
      and retry_count < max_attempts
    order by next_retry_at asc
    for update skip locked
    limit 10
  loop
    update public.tasks
    set status = 'pending', updated_at = now()
    where id = selected_task.id and status = 'retryable';

    if found then
      perform net.http_post(
        url := 'https://poenmzpdeykvstlfyxgg.supabase.co/functions/v1/coordinator-worker',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-ai-internal-token', internal_token
        ),
        body := jsonb_build_object('task_id', selected_task.id),
        timeout_milliseconds := 5000
      );

      insert into public.task_events (task_id, event_type, actor_type, payload)
      values (
        selected_task.id,
        'retry_dispatch_queued',
        'system',
        jsonb_build_object('runtime', 'runtime_retry_tick_v1.4', 'scheduled', true)
      );

      dispatched := dispatched + 1;
    end if;
  end loop;

  return dispatched;
end;
$fn$;

revoke all on function public.runtime_retry_tick() from public, anon, authenticated;

do $block$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'ai-sistem-retry-dispatch'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'ai-sistem-retry-dispatch',
    '* * * * *',
    $job$select public.runtime_retry_tick();$job$
  );
end;
$block$;