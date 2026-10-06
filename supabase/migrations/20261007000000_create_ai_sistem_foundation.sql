-- version 1.0
-- Ai-Sistem foundation schema

create extension if not exists pgcrypto;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','archived')),
  repository_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  role text not null,
  instruction_file text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  request text not null,
  status text not null default 'pending' check (status in ('pending','analyzing','consulting','implementing','verifying','completed','blocked','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  created_by text not null default 'telegram',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.task_participants (
  task_id uuid not null references public.tasks(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  participation_type text not null check (participation_type in ('primary','consultant','reviewer')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (task_id, agent_id)
);

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('user','coordinator','agent','system')),
  actor_id uuid references public.agents(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  decision_type text not null,
  decision text not null,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  approval_type text not null,
  status text not null check (status in ('pending','approved','rejected','blocked')),
  comment text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.project_memory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  memory_key text not null,
  content jsonb not null,
  source_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, memory_key)
);

create table public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  memory_key text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, project_id, memory_key)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  name text not null,
  document_type text not null,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  url text,
  title text,
  source_type text,
  accessed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  integration_type text not null,
  name text not null,
  status text not null default 'active' check (status in ('active','inactive','error')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete cascade,
  permission_key text not null,
  granted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, agent_id, integration_id, permission_key)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  actor_type text not null check (actor_type in ('user','coordinator','agent','system')),
  actor_id uuid references public.agents(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index tasks_project_id_idx on public.tasks(project_id);
create index tasks_status_idx on public.tasks(status);
create index task_events_task_id_idx on public.task_events(task_id);
create index decisions_task_id_idx on public.decisions(task_id);
create index approvals_task_id_idx on public.approvals(task_id);
create index project_memory_project_id_idx on public.project_memory(project_id);
create index agent_memory_agent_id_idx on public.agent_memory(agent_id);
create index documents_project_id_idx on public.documents(project_id);
create index integrations_project_id_idx on public.integrations(project_id);
create index permissions_project_id_idx on public.permissions(project_id);
create index permissions_agent_id_idx on public.permissions(agent_id);
create index audit_logs_project_id_idx on public.audit_logs(project_id);
create index audit_logs_task_id_idx on public.audit_logs(task_id);

alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.tasks enable row level security;
alter table public.task_participants enable row level security;
alter table public.task_events enable row level security;
alter table public.decisions enable row level security;
alter table public.approvals enable row level security;
alter table public.project_memory enable row level security;
alter table public.agent_memory enable row level security;
alter table public.documents enable row level security;
alter table public.sources enable row level security;
alter table public.integrations enable row level security;
alter table public.permissions enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

insert into public.projects (key, name, description)
values ('ai-sistem', 'Ai-Sistem', 'Universal AI Development System')
on conflict (key) do nothing;

insert into public.agents (key, name, role, instruction_file) values
('coordinator', 'Главный эксперт / Coordinator', 'orchestration', 'docs/coordinator.md'),
('financial-expert', 'Финансовый эксперт', 'financial methodology', 'docs/financial-expert.md'),
('historical-expert', 'Исторический эксперт', 'historical sources', 'docs/historical-expert.md'),
('developer-expert', 'Эксперт-разработчик', 'software development', 'docs/developer-expert.md'),
('scientific-expert', 'Научный эксперт', 'scientific validation', 'docs/scientific-expert.md'),
('ux-product-expert', 'UX Product Expert', 'product and user experience', 'docs/ux-product-expert.md'),
('security-expert', 'Security Expert', 'security', 'docs/security-expert.md'),
('data-statistics-expert', 'Data Statistics Expert', 'statistics and metrics', 'docs/data-statistics-expert.md'),
('economic-expert', 'Экономический эксперт', 'economic theory', 'docs/economic-expert.md')
on conflict (key) do nothing;
