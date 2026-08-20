-- Naukri Auto Refresh (opt-in)
-- Credentials are stored only in Supabase Vault; the browser can read connection
-- status but can never select the decrypted password.

create table if not exists public.naukri_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vault_secret_id uuid not null,
  profile_id text,
  enabled boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'connected', 'needs_reconnect', 'error', 'disabled')),
  last_attempt_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.naukri_connections enable row level security;

grant select on public.naukri_connections to authenticated;
grant all on public.naukri_connections to service_role;

create policy "naukri_connections_select_own"
on public.naukri_connections
for select
to authenticated
using ((select auth.uid()) = user_id);

create trigger naukri_connections_set_updated_at
before update on public.naukri_connections
for each row execute function public.set_updated_at();

create or replace function public.save_naukri_connection(
  p_username text,
  p_password text,
  p_profile_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_secret_id uuid;
  v_existing_secret_id uuid;
  v_secret_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(length(trim(p_username)), 0) = 0 then
    raise exception 'Naukri email or username is required';
  end if;

  if coalesce(length(p_password), 0) < 4 then
    raise exception 'Naukri password is required';
  end if;

  select vault_secret_id
    into v_existing_secret_id
  from public.naukri_connections
  where user_id = v_user_id;

  v_secret_name := 'jobpilot_naukri_' || replace(v_user_id::text, '-', '_');

  if v_existing_secret_id is null then
    select vault.create_secret(
      jsonb_build_object(
        'username', trim(p_username),
        'password', p_password
      )::text,
      v_secret_name,
      'Encrypted Naukri credentials for JobPilot user ' || v_user_id::text
    ) into v_secret_id;
  else
    perform vault.update_secret(
      v_existing_secret_id,
      jsonb_build_object(
        'username', trim(p_username),
        'password', p_password
      )::text,
      v_secret_name,
      'Encrypted Naukri credentials for JobPilot user ' || v_user_id::text
    );
    v_secret_id := v_existing_secret_id;
  end if;

  insert into public.naukri_connections (
    user_id,
    vault_secret_id,
    profile_id,
    enabled,
    status,
    last_error
  ) values (
    v_user_id,
    v_secret_id,
    nullif(trim(coalesce(p_profile_id, '')), ''),
    true,
    'pending',
    null
  )
  on conflict (user_id)
  do update set
    vault_secret_id = excluded.vault_secret_id,
    profile_id = coalesce(excluded.profile_id, public.naukri_connections.profile_id),
    enabled = true,
    status = 'pending',
    last_error = null,
    updated_at = now();
end;
$$;

revoke all on function public.save_naukri_connection(text, text, text) from public, anon;
grant execute on function public.save_naukri_connection(text, text, text) to authenticated;

create or replace function public.set_naukri_auto_refresh(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.naukri_connections
  set enabled = p_enabled,
      status = case when p_enabled then 'pending' else 'disabled' end,
      last_error = case when p_enabled then null else last_error end,
      updated_at = now()
  where user_id = v_user_id;
end;
$$;

revoke all on function public.set_naukri_auto_refresh(boolean) from public, anon;
grant execute on function public.set_naukri_auto_refresh(boolean) to authenticated;

create or replace function public.disconnect_naukri()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_secret_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select vault_secret_id into v_secret_id
  from public.naukri_connections
  where user_id = v_user_id;

  if v_secret_id is not null then
    -- Overwrite the encrypted secret before removing the connection metadata.
    perform vault.update_secret(v_secret_id, '{}');
  end if;

  delete from public.naukri_connections where user_id = v_user_id;
end;
$$;

revoke all on function public.disconnect_naukri() from public, anon;
grant execute on function public.disconnect_naukri() to authenticated;

-- Service-only helper used by the Edge Function. Authenticated users cannot call it.
create or replace function public.get_naukri_sync_credentials(p_user_id uuid)
returns table (
  username text,
  password text,
  profile_id text
)
language sql
security definer
set search_path = ''
as $$
  select
    (v.decrypted_secret::jsonb ->> 'username')::text,
    (v.decrypted_secret::jsonb ->> 'password')::text,
    c.profile_id
  from public.naukri_connections c
  join vault.decrypted_secrets v on v.id = c.vault_secret_id
  where c.user_id = p_user_id
    and c.enabled = true
  limit 1;
$$;

revoke all on function public.get_naukri_sync_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_naukri_sync_credentials(uuid) to service_role;

create or replace function public.update_naukri_sync_status(
  p_user_id uuid,
  p_status text,
  p_error text default null,
  p_profile_id text default null,
  p_synced boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('pending', 'connected', 'needs_reconnect', 'error', 'disabled') then
    raise exception 'Invalid Naukri connection status';
  end if;

  update public.naukri_connections
  set status = p_status,
      last_attempt_at = now(),
      last_sync_at = case when p_synced then now() else last_sync_at end,
      last_error = p_error,
      profile_id = coalesce(nullif(trim(coalesce(p_profile_id, '')), ''), profile_id),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.update_naukri_sync_status(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.update_naukri_sync_status(uuid, text, text, text, boolean) to service_role;

-- Secrets used only for the scheduled Edge Function invocation.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'jobpilot_project_url') then
    perform vault.create_secret(
      'https://biksibkvwjbomnruuliv.supabase.co',
      'jobpilot_project_url',
      'JobPilot Supabase project URL for pg_cron Edge Function calls'
    );
  end if;

  if not exists (select 1 from vault.secrets where name = 'jobpilot_naukri_cron_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'jobpilot_naukri_cron_token',
      'Internal authorization token for the JobPilot Naukri daily sync'
    );
  end if;
end
$$;

create or replace function public.verify_naukri_cron_token(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'jobpilot_naukri_cron_token'
      and decrypted_secret = p_token
  );
$$;

revoke all on function public.verify_naukri_cron_token(text) from public, anon, authenticated;
grant execute on function public.verify_naukri_cron_token(text) to service_role;

-- 09:00 India Standard Time every day (03:30 UTC).
select cron.schedule(
  'jobpilot-naukri-daily-refresh',
  '30 3 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'jobpilot_project_url') || '/functions/v1/naukri-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-jobpilot-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'jobpilot_naukri_cron_token')
      ),
      body := '{"mode":"scheduled"}'::jsonb
    );
  $$
);
