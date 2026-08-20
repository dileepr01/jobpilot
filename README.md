# JobPilot

JobPilot is a human-in-the-loop AI career and job-search assistant built with Next.js 14, Supabase, Hugging Face Inference Providers, GitHub Actions, Resend, and optional Telegram notifications.

Its product goal is **interviews per application, not application volume**. JobPilot ranks opportunities, explains why they deserve attention, prepares truthful application material, and learns from recorded outcomes.

Every Apply button opens the original job posting for the user to review and submit manually. JobPilot does not auto-submit applications or automate LinkedIn activity. LinkedIn, Glassdoor, Naukri, Indeed, and similar publisher listings can be surfaced through configured public/aggregation sources when those providers return them.

## What is included

- Email/password and Google OAuth through Supabase Auth
- Private PDF/DOCX resume storage and resume intelligence
- An editable **Career Profile** that becomes the user-controlled source of truth for skills, title, headline, summary and search preferences
- 384-dimensional profile/job embeddings using `sentence-transformers/all-MiniLM-L6-v2`
- pgvector candidate retrieval plus an explainable **Opportunity Score** covering semantic fit, target-role fit, verified skill overlap, seniority, freshness, location, work mode and compensation
- Three decision queues: **Apply now**, **Worth considering**, and **Low priority**
- Public job sources: Remotive, Adzuna, Jooble, JSearch, Himalayas, Remote OK, Greenhouse, Lever, and RSS
- Publisher attribution for JSearch results including LinkedIn, Glassdoor, Naukri, Indeed, Monster, Foundit, Dice, ZipRecruiter, SimplyHired, and Talent.com when present upstream
- Event-driven, per-user discovery after meaningful Career Profile changes, resume onboarding, or an explicit Search for jobs action
- Balanced per-source result caps, shared public-job caching, embedding reuse, and a short per-user search cooldown
- Truth-preserving application generation: JobPilot is instructed never to invent employers, dates, qualifications, tools, certifications, achievements, metrics or experience
- **Application Pack** with a tailored ATS resume, ATS gaps, cover letter, recruiter note, referral request, role/company snapshot and interview questions
- Application Kanban and an outcome learning loop that measures interview/offer response by role family
- **Career Presence** view for JobPilot, Naukri and LinkedIn
- Optional Naukri Profile Sync for genuine Career Profile deltas such as adding/removing Key Skills or changing verified profile text
- Resend email and optional Telegram alerts for Apply Now opportunities after searches
- CI and Vercel deployment workflows
- RLS on exposed user data and private per-user resume Storage policies

## Career Profile behavior

A resume is useful source evidence, but uploading a resume is **not** the mechanism for keeping a Naukri profile active.

Users can maintain their Career Profile directly:

- add or remove verified skills
- update current title and experience level
- edit the professional headline and summary
- change target roles, locations, work modes, compensation preference and notice period
- add followed companies and public company job feeds

When a meaningful matching field changes, JobPilot rebuilds the profile embedding, records a `career_profile_events` event, and attempts a fresh job search for that user. A short cooldown prevents duplicate searches caused by repeated taps.

Manually edited Career Profile fields are authoritative. AI-assisted profile intelligence does not silently overwrite user-verified fields.

## Naukri Profile Sync

Naukri does not publish a supported public job-seeker profile-edit API. JobPilot therefore treats its optional Naukri integration as an **unofficial, opt-in integration** that can break when Naukri changes its browser flow.

When explicitly connected by the user:

- Naukri credentials are encrypted in Supabase Vault and are not returned to the browser after connection.
- JobPilot reads the current Naukri profile and compares it with the verified JobPilot Career Profile.
- It writes only genuine deltas for supported fields such as resume headline, profile summary and Key Skills.
- If a user removes a skill from an authoritative JobPilot Career Profile, JobPilot does not re-add it merely because the old uploaded resume still mentions it.
- There are no punctuation toggles, fake edits or daily scheduled writes intended only to manufacture profile freshness.
- CAPTCHA, MFA or anti-bot challenges are never bypassed. The integration fails closed and asks the user to reconnect.

The previous 09:00 IST Naukri profile-write cron is removed by the Career Profile / Opportunity Intelligence migration. Users can also run an explicit Naukri sync from Career Presence.

LinkedIn stays manual by design: JobPilot may suggest wording, but it does not automate profile edits, connections, messages or other LinkedIn activity.

## Project structure

```text
app/                         Next.js App Router pages and route handlers
components/                  Responsive dashboard, Career Profile and application components
lib/                         Supabase clients, scoring, job sources, application intelligence and profile logic
scripts/                     Optional profile-suggestion entry points
supabase/migrations/         pgvector schema, RLS, search tracking and Career Profile events
supabase/functions/          Digest and opt-in Naukri sync Edge Functions
.github/workflows/           CI, profile suggestions and Vercel deployment
tests/                       Scoring, application intelligence, sources and resume-export tests
```

## 1. Install

```bash
cp .env.example .env.local
npm install
npm run dev
```

Use Node.js 22 or newer.

## 2. Configure Supabase

Create/link a Supabase project and apply migrations:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push
```

The migrations enable pgvector, create the profile/job/match/search tables, configure RLS/private resume Storage, expose the server-side matching RPCs, add `career_profile_events`, allow `profile_change` search triggers, add Application Pack persistence, and remove the old scheduled Naukri profile-write cron.

After applying migrations, run Supabase security and performance advisors.

### Auth configuration

In Supabase Auth:

1. Add `http://localhost:3000/auth/callback` as a local redirect URL.
2. Add the production Vercel callback URL.
3. Enable Google OAuth and configure its client ID and secret.
4. Keep email confirmations enabled for production.

## 3. Configure Hugging Face

```dotenv
HF_API_TOKEN=hf_xxx
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HF_TEXT_MODEL=Qwen/Qwen2.5-7B-Instruct
HF_TEXT_PROVIDER=together
HF_EMBEDDING_PROVIDER=hf-inference
```

Model availability varies by provider. The embedding layer has a deterministic local fallback so discovery can degrade gracefully when the remote embedding provider is unavailable.

## 4. Deploy Supabase Edge Functions

```bash
npx supabase@latest functions deploy send-digest
npx supabase@latest functions deploy naukri-sync
```

Set the required service secrets for Resend and application configuration. Naukri credentials are stored per-user in Vault after explicit connection; they are not environment variables.

## 5. Add job-source keys

Remotive, Himalayas, and Remote OK work without a key. Add any combination of:

```dotenv
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
ADZUNA_COUNTRY=in
JOOBLE_API_KEY=
RAPIDAPI_JSEARCH_KEY=
```

JSearch is an optional aggregation layer used to expand publisher coverage. Depending on upstream results, it can surface jobs published on LinkedIn, Glassdoor, Naukri, Indeed, and other boards without JobPilot signing in to those sites for job discovery.

Users can also add public Greenhouse board tokens, Lever company slugs and RSS feed URLs. Followed sources remain isolated to the authenticated user who added them.

## 6. GitHub Actions secrets

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `HF_API_TOKEN`
- optional job API keys
- optional `TELEGRAM_BOT_TOKEN`
- `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`

Optional repository variables:

- `HF_TEXT_MODEL`
- `HF_TEXT_PROVIDER`
- `HF_EMBEDDING_PROVIDER`
- `ADZUNA_COUNTRY`

There is **no scheduled daily job-discovery workflow**. Discovery is event-driven per user: resume onboarding, an explicit search, or a meaningful Career Profile change. There is also no daily scheduled Naukri profile-write workflow after the Career Profile migration.

## 7. Deploy to Vercel

Connect the repository directly in Vercel or use `.github/workflows/deploy-vercel.yml`. Keep Supabase service credentials and Hugging Face tokens server-only.

## Opportunity search pipeline

1. Authenticate the user.
2. Load only that user's Career Profile, target roles, locations and followed public sources.
3. Enforce a short per-user cooldown.
4. Query public/authorized sources and aggregation APIs.
5. Preserve publisher attribution and deduplicate by source/external ID.
6. Balance results across sources.
7. Hash descriptions, reuse cached embeddings and persist shared public job records.
8. Retrieve semantic candidates through pgvector.
9. Score each candidate using semantic fit, role, verified skills, seniority, freshness, location, work mode and salary signals.
10. Bucket roles into Apply now, Worth considering or Low priority.
11. Upsert only the requesting user's match records.
12. Record search metrics and optionally send Apply Now alerts.

Public job records can be shared across users because they are not private user data. Profiles, resumes, Career Profile events, followed sources, search runs, matches and application work remain user-isolated.

## Learning loop

The application pipeline is also a feedback mechanism. JobPilot counts applications and positive outcomes (`interview` / `offer`) and compares response rates across broad role families. It waits for a minimum amount of recorded outcome data before suggesting a change in search strategy, reducing the chance of overreacting to one application.

## Security and trust notes

- The browser receives only the Supabase publishable key.
- Supabase service credentials and Hugging Face tokens are never exposed through `NEXT_PUBLIC_` variables.
- RLS ownership predicates use `auth.uid()` and do not trust user-editable JWT metadata.
- Resume files are private and restricted to the authenticated user's folder.
- Job search runs and Career Profile events are user-isolated.
- Public job rows are read-only for authenticated users; server-side discovery performs writes.
- Tailored resumes require source resume evidence and are instructed not to invent candidate facts.
- Naukri sync is optional, unofficial and fail-closed on authentication challenges.
- External job URLs are third-party content; users should review destinations before submitting personal information.

## Validation commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The `prebuild` script runs typecheck, lint and tests automatically before production builds.

## Production hardening ideas

- Add Sentry or OpenTelemetry for per-user search failures.
- Add source-specific quotas and plan-aware request budgets as usage grows.
- Move high-volume discovery/embedding work to a durable queue if concurrent search traffic grows.
- Use a dedicated inference endpoint for predictable latency at scale.
- Add retention rules for stale jobs, search metrics and old application drafts.
- Add domain allow/deny lists for external job URLs.
- Replace the unofficial Naukri integration with a supported provider/API if Naukri offers one in the future.
