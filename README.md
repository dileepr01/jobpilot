# JobPilot

JobPilot is a human-in-the-loop AI job search assistant built with Next.js 14, Supabase, Hugging Face Inference Providers, GitHub Actions, Resend, and optional Telegram notifications.

It **does not** store LinkedIn or Naukri credentials, log in through a headless browser, scrape authenticated pages, or submit applications. Every Apply button opens the original job posting for the user to review and submit manually. LinkedIn, Glassdoor, Naukri, Indeed, and similar publisher listings can be surfaced through the configured JSearch aggregation API when that provider returns them; JobPilot records the publisher identity and keeps `JSearch` in metadata as the discovery path.

## What is included

- Email/password and Google OAuth through Supabase Auth
- Private PDF/DOCX resume upload to Supabase Storage
- Resume text extraction and structured resume intelligence
- 384-dimensional resume and job embeddings using `sentence-transformers/all-MiniLM-L6-v2`
- pgvector cosine-similarity matching with explainable preference bonuses
- Public job sources: Remotive, Adzuna, Jooble, JSearch, Himalayas, Remote OK, Greenhouse, Lever, and RSS
- Publisher attribution for JSearch results including LinkedIn, Glassdoor, Naukri, Indeed, Monster, Foundit, Dice, ZipRecruiter, SimplyHired, and Talent.com when present in upstream results
- On-demand, per-user job discovery triggered after resume onboarding or by the dashboard Search for jobs button
- Balanced per-source result caps, shared public-job caching, embedding reuse, and a short per-user search cooldown for multi-user safety
- AI-generated fit bullets, cover letters, resume keyword suggestions, and screening answers
- Job dashboard and application Kanban board
- Weekly LinkedIn/Naukri profile text suggestions with copy buttons and official edit-page links
- Resend email and optional Telegram high-match alerts after user-initiated searches
- CI and Vercel deployment workflows
- RLS on every exposed user-data table and private per-user resume Storage policies

## Project structure

```text
app/                         Next.js App Router pages and route handlers
components/                  Responsive dashboard and onboarding components
lib/                         Supabase clients, Hugging Face, scoring, job sources, on-demand search
scripts/                     Weekly profile-suggestion entry point
supabase/migrations/         pgvector schema, grants, RLS, Storage policies, search-run tracking
supabase/functions/          Resend digest Edge Function
.github/workflows/           CI, weekly suggestions, Vercel deployment
tests/                       Matching, source, and resume-export tests
```

## 1. Install

```bash
cp .env.example .env.local
npm install
npm run dev
```

Use Node.js 22 or newer. The repository pins direct dependency versions; commit the generated `package-lock.json` after the first successful install.

## 2. Configure Supabase

Create a Supabase project in a region near your users. Then apply the migrations:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push
```

The migrations:

- enable `pgcrypto` and `vector`
- create `profiles`, `jobs`, `matches`, `suggestions`, `job_sources`, `embedding_cache`, `daily_runs`, and `job_search_runs`
- create a 384-dimension HNSW vector index
- track each user-initiated job search separately for observability and cooldown enforcement
- explicitly grant Data API access required by newer Supabase projects
- enable RLS on exposed user-data tables
- create a private `resumes` bucket with user-folder policies
- expose a service-role-only `match_jobs_for_profile` RPC

After applying the migration, run Supabase security and performance advisors from the dashboard or CLI.

### Auth configuration

In Supabase Auth:

1. Add `http://localhost:3000/auth/callback` as a local redirect URL.
2. Add the production Vercel callback URL.
3. Enable Google OAuth and configure its client ID and secret.
4. Keep email confirmations enabled for production.

## 3. Configure Hugging Face

Create a Hugging Face token with Inference Providers permission and set:

```dotenv
HF_API_TOKEN=hf_xxx
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HF_TEXT_MODEL=Qwen/Qwen2.5-7B-Instruct
HF_TEXT_PROVIDER=together
HF_EMBEDDING_PROVIDER=hf-inference
```

Model availability varies by inference provider. Change the model/provider environment variables without code changes when a selected provider is unavailable for your account.

## 4. Deploy the digest Edge Function

```bash
npx supabase@latest functions deploy send-digest
npx supabase@latest secrets set \
  RESEND_API_KEY=re_xxx \
  RESEND_FROM_EMAIL='JobPilot <jobs@yourdomain.com>' \
  APP_URL='https://your-app.vercel.app'
```

`verify_jwt` is disabled because this is a service-to-service endpoint. The function validates the caller's Supabase secret key from the `apikey` header before processing the request.

## 5. Add job-source keys

Remotive, Himalayas, and Remote OK work without a key. Add any combination of:

```dotenv
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
ADZUNA_COUNTRY=in
JOOBLE_API_KEY=
RAPIDAPI_JSEARCH_KEY=
```

JSearch is the optional aggregation layer used to expand publisher coverage. Depending on upstream search results, it can surface jobs published on LinkedIn, Glassdoor, Naukri, Indeed, and other job boards without JobPilot logging into or scraping authenticated pages on those sites.

Users can add their own public Greenhouse board tokens, Lever company slugs, and RSS feed URLs from Settings. Those followed sources are isolated to the authenticated user who added them.

## 6. GitHub Actions secrets

Add these repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_KEY` (preferred repository secret name) or `SUPABASE_SERVICE_ROLE_KEY`
- `HF_API_TOKEN`
- optional job API keys
- optional `TELEGRAM_BOT_TOKEN`
- `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `VERCEL_TOKEN`

Optional repository variables:

- `HF_TEXT_MODEL`
- `HF_TEXT_PROVIDER`
- `HF_EMBEDDING_PROVIDER`
- `ADZUNA_COUNTRY`

There is **no scheduled daily job-discovery workflow**. Job discovery runs only for an authenticated user after resume onboarding or when that user explicitly chooses Search for jobs. The weekly profile-suggestion workflow is separate and does not crawl jobs.

## 7. Deploy to Vercel

Either connect the repository directly in Vercel or use the included `deploy-vercel.yml` workflow. Add all `.env.example` values to the Vercel project, keeping service-role and Hugging Face tokens server-only.

## On-demand search pipeline

1. Authenticate the requesting user.
2. Load only that user's resume profile, target roles, locations, and followed public sources.
3. Enforce a short per-user cooldown to prevent duplicate taps or API abuse.
4. Query public/authorized job sources and aggregation APIs for that user's search context.
5. Preserve upstream publisher attribution where available and deduplicate by source and external ID.
6. Balance the selected results across sources instead of allowing one provider to dominate the request.
7. Hash job descriptions, reuse cached embeddings, and persist public jobs in the shared jobs cache.
8. Retrieve semantic candidates through pgvector and apply role, location, work-mode, and salary preference scoring.
9. Upsert only the requesting user's match rows.
10. Record search metrics in `job_search_runs` and optionally send that user's email/Telegram high-match alerts.

Public job records are intentionally shared across users because they are not private user data; profiles, resumes, followed sources, search runs, matches, and application work remain user-isolated.

## Security notes

- The browser receives only the Supabase publishable key.
- The Supabase secret/service-role key and Hugging Face token are never exposed through `NEXT_PUBLIC_` variables.
- RLS ownership predicates use `auth.uid()` and do not trust user-editable JWT metadata.
- Resume files are private and restricted to the authenticated user's folder.
- `job_search_runs` can only be read by their owning authenticated user; writes are server-side.
- The public `jobs` table is read-only for authenticated users; server-side on-demand discovery performs writes.
- Generated application content is instructed not to invent experience, but users must review every draft.
- External job URLs should still be treated as third-party content; review the destination before entering personal information.

## Validation commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The `prebuild` script runs typecheck, lint, and tests automatically before production builds.

## Production hardening ideas

- Add Sentry or OpenTelemetry for per-user search failures.
- Add source-specific quotas and plan-aware request budgets as usage grows.
- Move high-volume discovery/embedding work to a durable queue if concurrent search traffic becomes large.
- Use a paid/dedicated Hugging Face endpoint for predictable latency.
- Add retention rules for stale job descriptions, search-run metrics, and old application drafts.
- Add domain allow/deny lists for external job URLs.
