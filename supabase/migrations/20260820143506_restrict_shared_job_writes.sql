-- Shared public job records are now written only by the server-side service-role client.
-- Remove the authenticated SECURITY DEFINER RPC so signed-in users cannot directly
-- inject or overwrite shared jobs through the Data API.

drop function if exists public.upsert_job_for_search(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
);
