-- version 1.0

alter table public.agent_runs
  add column if not exists attempt integer not null default 1 check (attempt >= 1);

alter table public.agent_runs
  drop constraint if exists agent_runs_task_id_agent_id_key;

create unique index if not exists agent_runs_task_agent_attempt_uidx
  on public.agent_runs(task_id, agent_id, attempt);

create index if not exists agent_runs_task_agent_status_idx
  on public.agent_runs(task_id, agent_id, status);