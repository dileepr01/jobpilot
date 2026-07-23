alter table public.matches
  add column if not exists tailored_resume
    jsonb not null default '{}'::jsonb,
  add column if not exists ats_report
    jsonb not null default '{}'::jsonb;

comment on column public.matches.tailored_resume is
  'Editable job-specific ATS resume generated from the user resume';

comment on column public.matches.ats_report is
  'ATS readiness report for the tailored resume';
