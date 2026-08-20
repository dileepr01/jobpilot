-- Career Profile / Opportunity Intelligence
-- Job discovery can now be triggered by a meaningful Career Profile change.

alter table public.job_search_runs
  drop constraint if exists job_search_runs_trigger_check;

alter table public.job_search_runs
  add constraint job_search_runs_trigger_check
  check (trigger in ('resume_upload', 'manual', 'profile_change'));

-- Nullable by design so older matches do not render an empty object as a
-- completed Application Pack before one has actually been prepared.
alter table public.matches
  add column if not exists application_pack jsonb;

create table if not exists public.career_profile_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'profile_change'
    check (event_type in ('profile_change', 'resume_upload', 'profile_refresh')),
  changed_fields jsonb not null default '[]'::jsonb,
  search_triggered boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists career_profile_events_user_created_idx
  on public.career_profile_events (user_id, created_at desc);

alter table public.career_profile_events enable row level security;
grant select, insert on public.career_profile_events to authenticated;
grant all on public.career_profile_events to service_role;

drop policy if exists "career_profile_events_select_own" on public.career_profile_events;
create policy "career_profile_events_select_own"
on public.career_profile_events
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "career_profile_events_insert_own" on public.career_profile_events;
create policy "career_profile_events_insert_own"
on public.career_profile_events
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- Naukri is event-driven now. Remove the previous 09:00 IST profile-write job.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'jobpilot-naukri-daily-refresh'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
exception
  when undefined_table or invalid_schema_name then
    null;
end
$$;
