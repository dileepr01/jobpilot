# JobPilot

JobPilot is a human-in-the-loop AI job search assistant built with Next.js 14, Supabase, Hugging Face Inference Providers, GitHub Actions, Resend, and optional Telegram notifications.

It **does not** store LinkedIn or Naukri credentials, log in through a headless browser, scrape authenticated pages, or submit applications. Every Apply button opens the original job posting for the user to review and submit manually.

## What is included

- Email/password and Google OAuth through Supabase Auth
- Private PDF/DOCX resume upload to Supabase Storage
- Resume text extraction and structured resume intelligence
- 384-dimensional resume and job embeddings using `sentence-transformers/all-MiniLM-L6-v2`
- pgvector cosine-similarity matching with explainable preference bonuses
- Public job sources: Remotive, Adzuna, Jooble, JSearch, Greenhouse, Lever, and RSS
- Cached embeddings and rate-limited Hugging Face calls
- AI-generated fit bullets, cover letters, resume keyword suggestions, and screening answers
- Daily job dashboard and application Kanban board
- Weekly LinkedIn/Naukri text suggestions with copy buttons and official edit-page links
- Daily Resend email digest and optional Telegram alerts for matches above 85
- GitHub Actions schedules, CI, and Vercel deployment workflow
- RLS on every exposed table and private per-user resume Storage policies

## Project structure

```text
app/                         Next.js App Router pages and route handlers
components/                  Responsive dashboard and onboarding components
lib/                         Supabase clients, Hugging Face, scoring, sources, pipeline
scripts/                     Daily and weekly scheduled entry points
supabase/migrations/         pgvector schema, grants, RLS, Storage policies
supabase/functions/          Resend digest Edge Function
.github/workflows/           CI, daily cron, weekly cron, Vercel deployment
tests/                       Matching score tests
```

## 1. Install

```bash
cp .env.example .env.local
npm install
npm run dev
```

Use Node.js 20 or newer. The repository pins direct dependency versions; commit the generated `package-lock.json` after the first successful install.

## 2. Configure Supabase

Create a Supabase project in a region near your users. Then apply the migration:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push
```

The migration:

- enables `pgcrypto` and `vector`
- creates `profiles`, `jobs`, `matches`, `suggestions`, `job_sources`, `embedding_cache`, and `daily_runs`
- creates a 384-dimension HNSW vector index
- explicitly grants Data API access required by newer Supabase projects
- enables RLS on every public table
- creates a private `resumes` bucket with user-folder policies
- exposes a service-role-only `match_jobs_for_profile` RPC

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
HF_TEXT_MODEL=mistralai/Mistral-7B-Instruct-v0.3
HF_PROVIDER=hf-inference
```

Model availability varies by inference provider. Change `HF_TEXT_MODEL` or `HF_PROVIDER` without code changes when a model is unavailable for your account or selected provider.

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

Remotive works without a key. Add any combination of:

```dotenv
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
ADZUNA_COUNTRY=in
JOOBLE_API_KEY=
RAPIDAPI_JSEARCH_KEY=
```

Users can add public Greenhouse board tokens, Lever company slugs, and RSS feed URLs from Settings.

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
- `HF_PROVIDER`
- `ADZUNA_COUNTRY`

The daily workflow runs at **02:30 UTC, which is 08:00 IST**. It can also be run manually from the Actions tab.

## 7. Deploy to Vercel

Either connect the repository directly in Vercel or use the included `deploy-vercel.yml` workflow. Add all `.env.example` values to the Vercel project, keeping service-role and Hugging Face tokens server-only.

## Daily pipeline

1. Load users with completed resume profiles.
2. Build a union of target-role and location queries.
3. Fetch only public/authorized job sources.
4. Deduplicate by source and external ID.
5. Hash descriptions and reuse cached embeddings.
6. Embed changed/new jobs with the same model used for resumes.
7. Retrieve semantic candidates through pgvector.
8. Add role, location, work-mode, and salary preference bonuses.
9. Store matches above 55 and mark 75+ as high matches in the UI.
10. Generate application kits for the top 10 high matches lacking a kit.
11. Send the top five by email and optional 85+ Telegram alerts.

## Security notes

- The browser receives only the Supabase publishable key.
- The Supabase secret/service-role key and Hugging Face token are never exposed through `NEXT_PUBLIC_` variables.
- RLS ownership predicates use `auth.uid()` and do not trust user-editable JWT metadata.
- Resume files are private and restricted to the authenticated user's folder.
- The public `jobs` table is read-only for authenticated users; scheduled service-role code performs writes.
- Generated application content is instructed not to invent experience, but users must review every draft.
- External job URLs should still be treated as third-party content; review the destination before entering personal information.

## Validation commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Production hardening ideas

- Add Sentry or OpenTelemetry for pipeline failures.
- Use a paid/dedicated Hugging Face endpoint for predictable latency.
- Add source-specific quotas and per-user daily generation budgets.
- Add retention rules for stale job descriptions and old application drafts.
- Add domain allow/deny lists for external job URLs.
