create table public.job_search_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger text not null check (trigger in ('resume_upload', 'manual')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  metrics jsonb not null default '{}'::jsonb,
  error_message text
);

create index job_search_runs_user_started_idx
  on public.job_search_runs (user_id, started_at desc);

grant select on public.job_search_runs to authenticated;
grant all on public.job_search_runs to service_role;

alter table public.job_search_runs enable row level security;

create policy "job_search_runs_select_own"
on public.job_search_runs
for select
to authenticated
using ((select auth.uid()) = user_id);
