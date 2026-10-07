# version 1.0

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (task_id, agent_id)
);

alter table public.agent_runs enable row level security;
revoke all on table public.agent_runs from anon, authenticated;

create index if not exists agent_runs_task_id_idx
  on public.agent_runs(task_id);

create index if not exists agent_runs_status_idx
  on public.agent_runs(status);
