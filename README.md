# 정부지원사업 매칭 서비스

Matches Korean SMBs/startups against government support programs (정부지원사업), enriched
and explained with Upstage Solar Pro via the Vercel AI SDK. Built from the plan in
[`docs/jiwon-plan.md`](docs/jiwon-plan.md) — see that file for the full product rationale and
phased roadmap.

## Stack

Next.js 14 (App Router) · Supabase (Postgres + Auth) · Upstage Solar Pro (`@ai-sdk/openai-compatible`)
· 토스페이먼츠 정기결제 · Resend · Tailwind CSS

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then run the schema migration:

   ```bash
   # via the Supabase SQL editor, or the CLI:
   supabase db push --db-url <your-connection-string>
   ```

   The schema is in [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql).

3. **Copy the env template and fill in real values:**

   ```bash
   cp .env.local.example .env.local
   ```

   | Var | Where to get it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
   | `UPSTAGE_API_KEY` | [console.upstage.ai](https://console.upstage.ai) — confirm the exact Solar Pro model id in [developers.upstage.ai](https://developers.upstage.ai) and update `lib/ai/client.ts` if it differs from `solar-pro` |
   | `BIZINFO_API_KEY` | [data.go.kr](https://www.data.go.kr) → 기업마당 API — use the **decoded** key (`==`, not `%3D%3D`) |
   | `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | [Toss Payments developer console](https://developers.tosspayments.com) |
   | `RESEND_API_KEY` | [resend.com](https://resend.com/api-keys) |
   | `CRON_SECRET` | any random string — also set it as a Vercel env var so Vercel Cron sends it automatically |

4. **Seed real program data** by running the sync script once locally:

   ```bash
   npm run sync
   ```

5. **Run the app:**

   ```bash
   npm run dev
   ```

## What's here

- `app/` — landing page, auth (`/login`, `/signup`), onboarding, dashboard, program detail,
  saved programs, settings, and the Pro upgrade flow, plus all API routes (`match`, `ai/explain`,
  `ai/draft`, `payments/billing`, `payments/webhook`, and the three cron jobs).
- `lib/matching.ts` — pure-SQL eligibility matching against a user's `profiles` row.
- `lib/ai/` — Upstage Solar Pro calls: program enrichment, match explanations, and application
  drafting.
- `lib/sync/syncPrograms.ts` — the bizinfo → Supabase sync, shared by `scripts/sync-programs.ts`
  (manual/local runs) and `app/api/cron/sync-programs/route.ts` (nightly Vercel Cron).
- `lib/payments.ts` — 토스페이먼츠 billing-key issuance and charging.
- `vercel.json` — three scheduled jobs: nightly program sync (02:00), daily new-match emails
  (09:00), and monthly subscription charges (03:00 on the 1st).

## Known gaps to close before launch

- **`programs` matching columns** (`business_types`, `min/max_employees`, `min/max_revenue`) are
  populated by the AI enrichment step only where it can confidently infer them from free text —
  `min/max_revenue` and `business_types` are not extracted by the current bizinfo sync and will
  be `null` until a manual curation pass or a richer enrichment prompt fills them in.
- **K-Startup source and manual curation** (Phase 1 of the plan) aren't wired up — only bizinfo
  is implemented in `lib/sync/syncPrograms.ts`.
- **카카오 OAuth** (Phase 4) isn't configured — only email/password auth is enabled.
- **Toss customerKey** is generated client-side with `crypto.randomUUID()` in
  `app/(app)/upgrade/page.tsx` for simplicity; production should derive and pass it from the
  server so it can be looked up reliably from webhooks.
- The Toss billing flow charges the first month synchronously in `app/api/payments/billing/route.ts`
  before marking the user Pro — if that first charge fails, the user sees `?upgrade=failed` but
  a card *was* registered (billingKey exists, unused). Decide whether to store it and let them
  retry, or discard it.
