-- Keep Vault writes completely outside the authenticated Data API surface.
-- The authenticated Edge Function derives the caller from their JWT and invokes
-- these helpers using the service role only.

revoke all on function public.save_naukri_connection(text, text, text) from authenticated;
revoke all on function public.set_naukri_auto_refresh(boolean) from authenticated;
revoke all on function public.disconnect_naukri() from authenticated;

drop function if exists public.save_naukri_connection(text, text, text);
drop function if exists public.set_naukri_auto_refresh(boolean);
drop function if exists public.disconnect_naukri();

create or replace function public.save_naukri_connection_for_user(
  p_user_id uuid,
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
  v_secret_id uuid;
  v_existing_secret_id uuid;
  v_secret_name text;
begin
  if p_user_id is null then
    raise exception 'User is required';
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
  where user_id = p_user_id;

  v_secret_name := 'jobpilot_naukri_' || replace(p_user_id::text, '-', '_');

  if v_existing_secret_id is null then
    select vault.create_secret(
      jsonb_build_object(
        'username', trim(p_username),
        'password', p_password
      )::text,
      v_secret_name,
      'Encrypted Naukri credentials for JobPilot user ' || p_user_id::text
    ) into v_secret_id;
  else
    perform vault.update_secret(
      v_existing_secret_id,
      jsonb_build_object(
        'username', trim(p_username),
        'password', p_password
      )::text,
      v_secret_name,
      'Encrypted Naukri credentials for JobPilot user ' || p_user_id::text
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
    p_user_id,
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

revoke all on function public.save_naukri_connection_for_user(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.save_naukri_connection_for_user(uuid, text, text, text) to service_role;

create or replace function public.set_naukri_auto_refresh_for_user(
  p_user_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.naukri_connections
  set enabled = p_enabled,
      status = case when p_enabled then 'pending' else 'disabled' end,
      last_error = case when p_enabled then null else last_error end,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.set_naukri_auto_refresh_for_user(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_naukri_auto_refresh_for_user(uuid, boolean) to service_role;

create or replace function public.disconnect_naukri_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
begin
  select vault_secret_id into v_secret_id
  from public.naukri_connections
  where user_id = p_user_id;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, '{}');
  end if;

  delete from public.naukri_connections where user_id = p_user_id;
end;
$$;

revoke all on function public.disconnect_naukri_for_user(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_naukri_for_user(uuid) to service_role;
