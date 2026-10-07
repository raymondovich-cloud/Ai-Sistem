# version 1.0

begin;

alter table public.tasks drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (
    status = any (
      array[
        'pending'::text,
        'consulting'::text,
        'synthesizing'::text,
        'completed'::text,
        'retryable'::text,
        'failed'::text,
        'blocked'::text,
        'cancelled'::text
      ]
    )
  );

create or replace function public.enforce_task_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('consulting', 'retryable', 'failed', 'blocked', 'cancelled') then
    return new;
  end if;

  if old.status = 'consulting' and new.status in ('synthesizing', 'retryable', 'failed', 'blocked', 'cancelled') then
    return new;
  end if;

  if old.status = 'synthesizing' and new.status in ('completed', 'retryable', 'failed') then
    return new;
  end if;

  if old.status = 'retryable' and new.status in ('pending', 'failed', 'cancelled') then
    return new;
  end if;

  if old.status in ('completed', 'failed', 'blocked', 'cancelled') then
    raise exception 'invalid_task_lifecycle_transition: % -> %', old.status, new.status;
  end if;

  raise exception 'invalid_task_lifecycle_transition: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists enforce_task_lifecycle on public.tasks;

create trigger enforce_task_lifecycle
before update of status on public.tasks
for each row
execute function public.enforce_task_lifecycle();

revoke execute on function public.enforce_task_lifecycle() from public, anon, authenticated;

commit;
