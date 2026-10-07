-- version 1.0

create table if not exists public.telegram_access (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null unique,
  chat_id text,
  role text not null default 'owner' check (role in ('owner','admin','operator')),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_updates (
  id uuid primary key default gen_random_uuid(),
  telegram_update_id bigint not null unique,
  telegram_user_id text not null,
  chat_id text not null,
  task_id uuid references public.tasks(id) on delete set null,
  received_at timestamptz not null default now()
);

create table if not exists public.task_finalizations (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  status text not null default 'claimed' check (status in ('claimed','sent','failed')),
  claim_token uuid not null default gen_random_uuid(),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  attempt_count integer not null default 1 check (attempt_count >= 1)
);

alter table public.tasks add column if not exists retry_count integer not null default 0;
alter table public.tasks add column if not exists max_attempts integer not null default 3;
alter table public.tasks add column if not exists failure_class text check (failure_class is null or failure_class in ('retryable','permanent'));
alter table public.tasks add column if not exists next_retry_at timestamptz;
alter table public.tasks add column if not exists last_error text;

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('pending','analyzing','consulting','implementing','verifying','completed','blocked','cancelled','retryable','failed'));

create index if not exists telegram_updates_task_id_idx on public.telegram_updates(task_id);
create index if not exists telegram_updates_received_at_idx on public.telegram_updates(received_at);
create index if not exists task_finalizations_status_idx on public.task_finalizations(status);
create index if not exists tasks_retryable_idx on public.tasks(status, next_retry_at) where status = 'retryable';

alter table public.telegram_access enable row level security;
alter table public.telegram_updates enable row level security;
alter table public.task_finalizations enable row level security;

revoke all on table public.telegram_access from anon, authenticated;
revoke all on table public.telegram_updates from anon, authenticated;
revoke all on table public.task_finalizations from anon, authenticated;