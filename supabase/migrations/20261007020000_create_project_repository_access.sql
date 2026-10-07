-- version 1.0
-- Runtime 1.2 controlled project repository access

create table public.project_repository_access (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  provider text not null check (provider in ('github')),
  repository_url text not null,
  ref text not null,
  allowed_paths jsonb not null default '[]'::jsonb,
  default_evidence_paths jsonb not null default '[]'::jsonb,
  max_files integer not null default 12 check (max_files between 1 and 50),
  max_bytes_per_file integer not null default 200000 check (max_bytes_per_file between 1024 and 1000000),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_repository_access_project_id_idx on public.project_repository_access(project_id);

alter table public.project_repository_access enable row level security;
revoke all on public.project_repository_access from anon;
revoke all on public.project_repository_access from authenticated;

insert into public.project_repository_access (project_id,provider,repository_url,ref,allowed_paths,default_evidence_paths)
select p.id,'github','https://github.com/raymondovich-cloud/Ai-Sistem','main',
'["docs/","supabase/functions/","supabase/migrations/","supabase/config.toml",".github/workflows/"]'::jsonb,
'["docs/agent.md","docs/coordinator.md","docs/developer-expert.md","docs/security-expert.md","supabase/migrations/20261007000000_create_ai_sistem_foundation.sql","supabase/migrations/20261007010000_create_agent_runs.sql","supabase/functions/telegram-webhook/index.ts","supabase/functions/coordinator-worker/index.ts","supabase/functions/expert-worker/index.ts","supabase/functions/ai-provider-worker/index.ts","supabase/functions/result-aggregator/index.ts"]'::jsonb
from public.projects p where p.key='ai-sistem' on conflict (project_id) do nothing;