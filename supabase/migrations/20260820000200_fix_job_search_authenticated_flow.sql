grant insert, update on table public.job_search_runs to authenticated;

create policy "job_search_runs_insert_own"
on public.job_search_runs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "job_search_runs_update_own"
on public.job_search_runs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.upsert_job_for_search(
  p_source text,
  p_external_id text,
  p_external_url text,
  p_title text,
  p_company text,
  p_location text,
  p_work_mode text,
  p_salary_min numeric,
  p_salary_max numeric,
  p_salary_currency text,
  p_description text,
  p_description_hash text,
  p_embedding text,
  p_posted_at timestamptz,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(length(trim(p_source)), 0) = 0
     or coalesce(length(trim(p_external_id)), 0) = 0
     or coalesce(length(trim(p_title)), 0) = 0
     or coalesce(length(trim(p_company)), 0) = 0
     or coalesce(length(trim(p_description)), 0) = 0
     or p_external_url !~ '^https?://' then
    raise exception 'Invalid discovered job payload';
  end if;

  insert into public.jobs (
    source,
    external_id,
    external_url,
    title,
    company,
    location,
    work_mode,
    salary_min,
    salary_max,
    salary_currency,
    description,
    description_hash,
    embedding,
    posted_at,
    last_seen_at,
    metadata
  ) values (
    left(p_source, 120),
    left(p_external_id, 500),
    p_external_url,
    left(p_title, 500),
    left(p_company, 500),
    nullif(left(coalesce(p_location, ''), 500), ''),
    nullif(left(coalesce(p_work_mode, ''), 100), ''),
    p_salary_min,
    p_salary_max,
    nullif(left(coalesce(p_salary_currency, ''), 20), ''),
    p_description,
    p_description_hash,
    case
      when p_embedding is null or p_embedding = '' then null
      else cast(p_embedding as extensions.vector)
    end,
    p_posted_at,
    now(),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (source, external_id)
  do update set
    external_url = excluded.external_url,
    title = excluded.title,
    company = excluded.company,
    location = excluded.location,
    work_mode = excluded.work_mode,
    salary_min = excluded.salary_min,
    salary_max = excluded.salary_max,
    salary_currency = excluded.salary_currency,
    description = excluded.description,
    description_hash = excluded.description_hash,
    embedding = excluded.embedding,
    posted_at = excluded.posted_at,
    last_seen_at = now(),
    metadata = excluded.metadata
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_job_for_search(
  text,text,text,text,text,text,text,numeric,numeric,text,text,text,text,timestamptz,jsonb
) from public;

grant execute on function public.upsert_job_for_search(
  text,text,text,text,text,text,text,numeric,numeric,text,text,text,text,timestamptz,jsonb
) to authenticated;
