# eunwon AI

Matches Korean SMBs/startups against government support programs (정부지원사업), enriched
and explained with Upstage Solar Pro. Built from [`docs/jiwon-plan.md`](docs/jiwon-plan.md) (the
original MVP plan) and expanded per [`docs/eunwon-master.md`](docs/eunwon-master.md) (real
eligibility filtering, 사업계획서 generation, deadline alerts, 중복수혜 tracking) — see those files
for full product rationale and phased roadmap.

## Stack

Next.js 14 (App Router) · Supabase (Postgres + Auth) · Upstage Solar Pro (`openai` SDK against
Upstage's OpenAI-compatible endpoint) · 토스페이먼츠 정기결제 · Resend · Tailwind CSS

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then run both migrations in order:

   ```bash
   # via the Supabase SQL editor, or the CLI:
   supabase db push --db-url <your-connection-string>
   ```

   [`001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) creates the base schema;
   [`002_expand_profile_and_features.sql`](supabase/migrations/002_expand_profile_and_features.sql)
   reworks `profiles` around real eligibility fields, turns `saved_programs` into an
   application-outcome tracker, renames `notifications` → `notification_log`, and adds
   `user_documents`. **002 contains destructive `ALTER`/`DROP` statements against real columns —
   review it before running against a database with real user data.**

3. **Copy the env template and fill in real values:**

   ```bash
   cp .env.local.example .env.local
   ```

   | Var | Where to get it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
   | `UPSTAGE_API_KEY` | [console.upstage.ai](https://console.upstage.ai) — model id is `solar-pro4` (see `lib/ai/client.ts`); confirm it hasn't changed at [console.upstage.ai/docs/getting-started](https://console.upstage.ai/docs/getting-started) |
   | `BIZINFO_API_KEY` | [data.go.kr](https://www.data.go.kr) → 기업마당 API — use the **decoded** key (`==`, not `%3D%3D`) |
   | `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | [Toss Payments developer console](https://developers.tosspayments.com) — requires an approved business account (사업자등록증). Until set, every upgrade entry point in the UI hides itself (see `TOSS_ENABLED` in `lib/payments.ts`) instead of sending users into a broken checkout. |
   | `RESEND_API_KEY` | [resend.com](https://resend.com/api-keys) — needs a verified sending domain for `alerts@` and Supabase's own auth emails to actually deliver |
   | `NEXT_PUBLIC_APP_URL` | Canonical service origin used for OAuth callbacks and absolute links. Production must use `https://www.eunwon.com`. Add `https://www.eunwon.com/auth/callback` to Supabase Auth's redirect allowlist. |
   | `CRON_SECRET` | any random string you invent — also set the same value as a Vercel env var so Vercel Cron sends it automatically in the `Authorization` header |

4. **Seed real program data** by running the sync script once locally:

   ```bash
   npm run sync
   ```

5. **Run the app:**

   ```bash
   npm run dev
   ```

## What's here

- `app/` — landing page, auth (`/login`, `/signup`), `/onboard` (4-step wizard), `/dashboard`
  (+ `/dashboard/saved` application tracker), `/program/[id]` (+ `/program/[id]/generate` for
  사업계획서 generation), `/settings/{profile,notifications,billing,documents}`, `/upgrade`, and
  every API route (`match`, `ai/explain`, `ai/generate-document`, `payments/*`, and the three
  cron jobs).
- `lib/matching.ts` — pure-SQL eligibility matching against a user's `profiles` row
  (region/is_nationwide, entity_type, age_months), a match-count helper, a match-score helper for
  the dashboard's "매칭도 N%" badge, and `findDuplicateBenefitConflict` for the 중복수혜 warning
  shown on program detail pages.
- `lib/ai/` — Upstage Solar Pro calls: program enrichment (at sync time), match explanations, and
  full 사업계획서 generation (사업 개요 → 신청 배경 → 추진 계획 → 기대 효과).
- `lib/sync/syncPrograms.ts` — the bizinfo → Supabase sync, shared by `scripts/sync-programs.ts`
  (manual/local runs, loads `.env.local` explicitly since ES module imports hoist above a bare
  `dotenv/config`) and `app/api/cron/sync-programs/route.ts` (nightly Vercel Cron).
- `lib/payments.ts` — 토스페이먼츠 billing-key issuance/charging, plus `TOSS_ENABLED`.
- `vercel.json` — nightly program sync (02:00 KST), daily new-match + deadline-alert emails
  (09:00 KST, Pro-only), and monthly subscription charges (03:00 KST on the 1st).

## Known gaps to close before launch

- **Document vault (Phase 5)** — `user_documents` table exists but there's no Storage bucket, no
  upload UI, and no PDF text-extraction into the document-generation prompt yet.
- **사업계획서 export** — generation returns plain text in-app (copy button only); `.docx` export
  (the `docx` npm package, per the plan) isn't wired up.
- **Generation limits** — Pro is unlimited in code right now; the plan's "5/month" cap for a
  future Pro+ tier isn't enforced anywhere.
- **중복수혜 detection** is a simple heuristic (same `category` as a program the user marked
  `selected` for) — it's a real signal, not a guarantee; a false negative/positive is possible.
- **K-Startup source and manual curation** aren't wired up — only bizinfo is implemented in
  `lib/sync/syncPrograms.ts`.
- **카카오 OAuth** isn't configured — only email/password auth is enabled.
- **Toss customerKey** is generated client-side with `crypto.randomUUID()` in
  `components/UpgradeForm.tsx` for simplicity; production should derive and pass it from the
  server so it can be looked up reliably from webhooks.
- The Toss billing flow charges the first month synchronously in `app/api/payments/billing/route.ts`
  before marking the user Pro — if that first charge fails, the user sees `?upgrade=failed` but
  a card *was* registered (billingKey exists, unused). Decide whether to store it and let them
  retry, or discard it.
