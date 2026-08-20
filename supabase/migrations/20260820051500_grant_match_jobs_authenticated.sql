-- Allow signed-in users to run semantic job matching through the Data API.
-- The function is SECURITY INVOKER, so existing RLS policies still restrict
-- profile access to auth.uid() while jobs remain readable to authenticated users.
revoke all on function public.match_jobs_for_profile(uuid, timestamptz, integer) from public, anon;
grant execute on function public.match_jobs_for_profile(uuid, timestamptz, integer) to authenticated, service_role;
