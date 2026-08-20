alter table public.profiles
  add column if not exists auto_career_profile boolean not null default true,
  add column if not exists career_profile jsonb not null default '{"headline":"","summary":"","keywords":""}'::jsonb,
  add column if not exists career_profile_updated_at timestamptz;

-- Existing profiles RLS already restricts updates to auth.uid().
-- These columns are therefore writable only through the same own-profile policy.
