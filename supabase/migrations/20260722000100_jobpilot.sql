-- JobPilot initial schema
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create type public.match_status as enum ('new', 'reviewed', 'applied', 'interview', 'offer', 'rejected');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  preferences jsonb not null default '{"targetRoles":[],"locations":[],"workModes":[]}'::jsonb,
  resume_url text,
  resume_filename text,
  resume_text text,
  parsed_resume jsonb not null default '{}'::jsonb,
  resume_embedding extensions.vector(384),
  email_digest_enabled boolean not null default true,
  telegram_enabled boolean not null default false,
  telegram_chat_id text,
  linkedin_last_updated_at timestamptz,
  naukri_last_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  source text not null,
  external_id text not null,
  external_url text not null,
  title text not null,
  company text not null,
  location text,
  work_mode text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  description text not null,
  description_hash text not null,
  embedding extensions.vector(384),
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (source, external_id)
);

create table public.matches (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  score numeric(5,1) not null check (score >= 0 and score <= 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  status public.match_status not null default 'new',
  why_fit jsonb not null default '[]'::jsonb,
  cover_letter text,
  resume_tweaks jsonb not null default '[]'::jsonb,
  screening_answers jsonb not null default '[]'::jsonb,
  notes text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.suggestions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  content text not null,
  deep_link text,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.job_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('greenhouse', 'lever', 'rss')),
  label text not null,
  identifier text,
  feed_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (source_type in ('greenhouse', 'lever') and identifier ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$')
    or (source_type = 'rss' and feed_url ~ '^https://[^[:space:]]{1,1900}$')
  )
);

create table public.embedding_cache (
  text_hash text primary key,
  model text not null,
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now()
);

create table public.daily_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  run_type text not null check (run_type in ('daily_jobs', 'weekly_suggestions')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  metrics jsonb not null default '{}'::jsonb,
  error_message text
);

create index jobs_posted_at_idx on public.jobs (posted_at desc nulls last);
create index jobs_company_title_idx on public.jobs (company, title);
create index jobs_embedding_hnsw_idx on public.jobs using hnsw (embedding extensions.vector_cosine_ops) where embedding is not null;
create index matches_user_score_idx on public.matches (user_id, score desc);
create index matches_user_status_idx on public.matches (user_id, status, updated_at desc);
create index suggestions_user_active_idx on public.suggestions (user_id, dismissed, created_at desc);
create index job_sources_user_active_idx on public.job_sources (user_id, active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger matches_set_updated_at before update on public.matches
for each row execute function public.set_updated_at();

create or replace function public.match_jobs_for_profile(
  p_user_id uuid,
  p_since timestamptz default now() - interval '21 days',
  p_limit integer default 200
)
returns table (job_id uuid, semantic_similarity real)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    j.id,
    greatest(-1, least(1, 1 - (j.embedding OPERATOR(extensions.<=>) p.resume_embedding)))::real as semantic_similarity
  from public.profiles p
  join public.jobs j on j.embedding is not null
  where p.user_id = p_user_id
    and p.resume_embedding is not null
    and coalesce(j.posted_at, j.first_seen_at) >= p_since
  order by j.embedding OPERATOR(extensions.<=>) p.resume_embedding
  limit least(greatest(p_limit, 1), 500);
$$;

revoke all on function public.match_jobs_for_profile(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.match_jobs_for_profile(uuid, timestamptz, integer) to service_role;

-- Explicit Data API grants for projects created after the 2026 exposure change.
grant select, insert, update on public.profiles to authenticated;
grant select on public.jobs to authenticated;
grant select, insert, update on public.matches to authenticated;
grant select, update on public.suggestions to authenticated;
grant select, insert, update, delete on public.job_sources to authenticated;
grant all on public.profiles, public.jobs, public.matches, public.suggestions, public.job_sources, public.embedding_cache, public.daily_runs to service_role;

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.matches enable row level security;
alter table public.suggestions enable row level security;
alter table public.job_sources enable row level security;
alter table public.embedding_cache enable row level security;
alter table public.daily_runs enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "jobs_read_authenticated" on public.jobs for select to authenticated using (true);

create policy "matches_select_own" on public.matches for select to authenticated
using ((select auth.uid()) = user_id);
create policy "matches_insert_own" on public.matches for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "matches_update_own" on public.matches for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "suggestions_select_own" on public.suggestions for select to authenticated
using ((select auth.uid()) = user_id);
create policy "suggestions_update_own" on public.suggestions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "job_sources_select_own" on public.job_sources for select to authenticated
using ((select auth.uid()) = user_id);
create policy "job_sources_insert_own" on public.job_sources for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "job_sources_update_own" on public.job_sources for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "job_sources_delete_own" on public.job_sources for delete to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  4194304,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "resume_objects_select_own" on storage.objects for select to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "resume_objects_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "resume_objects_update_own" on storage.objects for update to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "resume_objects_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid()::text));
