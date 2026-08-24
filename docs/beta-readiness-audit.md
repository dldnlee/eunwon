# Customer beta readiness audit

Last updated: 2026-08-24

Scope: repository and connected production Supabase inspection for the primary journey
`profile → matches → save → prepare/apply → next action`, plus notifications, events, calendar,
sharing, authentication/RLS, resilience, accessibility, mobile, and production build. This is an
evidence log, not a claim that unrun external delivery or payment outcomes succeeded.

## Release summary

Status: **focused beta with release blockers**.

The application compiles, lints, type-checks, and builds; the saved-program tracker, split
notification preferences, Events discovery/save/reminder/calendar flow, source-backed preparation
checklist, and saved-program ICS deadline export are implemented. Production migrations 011-017
are applied and their new RLS/policies/indexes were inspected.

Before inviting customers, complete the critical items below:

1. Keep corpus-wide evidence population stopped until a new controlled pilot passes. Extractor v4
   now passes the targeted five-program gate that addressed the v2 pilot defects.
2. Run an explicitly authorized test-recipient delivery check for each notification category.
   Authenticated production acceptance now passes, but email delivery was deliberately not triggered.
3. Revisit Supabase leaked-password protection before broad launch. The owner explicitly chose not
   to enable it for this focused beta.

## Evidence matrix

| Area | Status | Evidence and remaining work |
|---|---|---|
| Authentication and route protection | Pass; one configuration gate | App layout and pages re-check the session server-side. API mutations authenticate and scope ownership. `/events` is covered by middleware and server authentication. Migration 018 removed the public `email_is_registered` SECURITY DEFINER RPC, and signup now returns the same non-enumerating completion state for new and existing addresses. Leaked-password protection remains disabled. |
| Onboarding and profile | Pass | Signed-in production acceptance used the designated showcase account and loaded its complete company profile without errors. Form validation and responsive controls remain covered by code/UI review. |
| Credible matching | Pass for populated v4 evidence; coverage partial | T9 compares compatible profile fields with met/not-met/unknown states and never converts missing/inferred/unsupported evidence into a verdict. T10 persists reproducible owner-only evidence/profile/freshness components and labels its score as data quality, not eligibility probability. A hard mismatch controls the state and AI explanation cannot override it. Evidence coverage remains limited pending a controlled pilot. |
| Saved programs and tracker | Pass | Eight-stage atomic transition, ownership check, history, next action/date, outcomes, notes, and empty state are implemented. Anonymous RPC execution is explicitly revoked; authenticated execution remains intentional and ownership-checked. |
| Preparation checklist | Pass, data-dependent | User-owned RLS table and API support source snapshots, completion, manual items, verified/inferred distinction, confidence, exact quote, source link, and resilient states. Manual items cannot claim stored citations. Automatic items are available for the sampled programs; other programs remain unavailable until their evidence is populated. |
| Notification preferences | Pass (code and route boundary) | Opportunity briefing, saved-program deadline reminders, and event reminders have independent controls and configurable lead times. Digest selection is capped/deduplicated and tested; deadline reminders are preserved. On 2026-08-23 the configured production route `/api/cron/notify-users` rejected an invalid token with 401. No email was sent during smoke testing; authorized test-recipient delivery remains. |
| Events | Pass for customer flow; importer observation pending | Authenticated production `/events` rendered 200 ranked events with profile reasons, filters, source links, save controls, and no console errors. Distinct reminders and owner-only ICS are implemented/tested. `event_sync_runs` still needs an observed enhanced importer run. |
| Calendar | Pass for provider-free phase | Event ICS and saved-program deadline ICS use all-day dates, exclusive end dates, stable IDs, Korean-safe line folding, canonical URLs, private/no-store authenticated download, and deterministic tests. Google OAuth sync remains a later consented phase. |
| Program comparison | Pass | Signed-in users can select 2–4 dashboard programs and compare eligibility state, evidence quality, benefits, deadlines, preparation, application progress, and next action. The URL preserves valid selection IDs, user-owned progress remains RLS-scoped, missing data is explicit, and mobile uses a stacked fallback. |
| Sharing | Partial | Native Web Share with copy fallback exists. Program detail pages are authenticated and the current payload uses the browser URL, so the roadmap's canonical public-share promise is not complete. Never add match/profile/application details to shares. |
| Errors and empty states | Pass with follow-up | Main dashboard, saved list, events, checklist, forms, and not-found states are present. Checklist/API failures are user-safe. Contact/notification Resend construction was moved to request time so absent local secrets no longer break builds. Add route-level `error.tsx` boundaries for finer recovery. |
| Accessibility and mobile | Pass for changed flows | UI uses semantic sections/lists, labels, live regions, focus rings, 44px mobile targets, keyboard-native controls, and responsive layouts. Checklist was inspected at 1280×900 and 390×844 with no overflow or console errors. Full WCAG assistive-technology regression remains a pre-broad-launch task. |
| RLS and database security | Pass for new schema; accepted configuration risk | Migrations 011-018 and the T10 match-assessment migration are live. Checklist and match-assessment data are owner-scoped with indexed FKs; eligibility writes are service-only. The account-enumeration warning is cleared. Advisors still report older RLS init-plan warnings, intentional authenticated tracker SECURITY DEFINER execution, and leaked-password protection disabled by owner decision. |
| Production build | Pass | `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass after lazy Resend initialization. Build produced 27 pages/routes. |
| Payments | Not exercised | Billing routes and recurring charge cron were not invoked or modified, per scope. Validate separately only with explicit financial test authorization and provider-safe fixtures. |

## Verification record

- Unit suite: 29 deterministic tests, including cache reuse, failed-run retry, prior-evidence
  preservation, and the zero-result extraction failure contract.
- Static checks: Next ESLint and TypeScript pass.
- Production build: Next.js 14.2.35 optimized build passes.
- Supabase: migrations 011, 015, 016, and 017 applied in this phase; migrations 012-014 had already
  been applied. New table RLS/policies/indexes and function grants verified by catalog queries.
- Security follow-up: migration 018 removed `email_is_registered`; catalog verification returned
  zero matching functions and both anonymous/authenticated advisor warnings disappeared.
- Advisor references:
  [database linter](https://supabase.com/docs/guides/database/database-linter),
  [RLS performance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select),
  [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Recommended next sequence

1. Implement T12 duplicate-benefit detection v2 using explicit program rules and user outcomes,
   replacing the current same-category warning where evidence exists; do not perform a corpus-wide
   backfill yet.
2. Complete authorized test-recipient notification delivery without involving customer accounts or
   unsolicited recipients.
3. Review the existing dependency audit findings; leaked-password protection is an accepted beta
   risk and must be reconsidered before broad launch.
4. T9 deterministic profile gap analysis, which can now consume normalized cited requirements.
5. T20 admin read-only import/extraction/notification health so beta support can diagnose failures.

## T2 observed evidence review

The sample tool selected three recent active programs without a successful extraction for the
current extractor version. It uses stored public program text, writes through the same
fingerprint/version cache as nightly import, and refuses a requested sample outside 1–5.

- Version 1: three succeeded runs, nine requirements, all exact citations. One clearly eligible
  program returned zero requirements, demonstrating that “valid JSON” alone was an insufficient
  success condition.
- Corrective change: extractor version 2 strengthens semantic support instructions and throws when
  a non-empty target source yields zero requirements. The last successful version remains intact
  if a later extraction fails.
- Version 2 rerun: three succeeded runs, three source documents each, 12 requirements total,
  11 `verified` and one `inferred`; stored confidence 0.900–1.000. SQL validation found zero
  verified rows with a missing source, missing quote, or quote absent from source text.
- Read-only revalidation after adding persistence coverage found the same latest state: 3/3 v2 runs
  succeeded, 12 requirements (11 verified, one inferred), zero invalid verified citations, and zero
  latest-run errors. Mocked persistence tests prove successful fingerprints skip extraction, a failed
  same-version run can be retried, and extraction failure does not delete prior requirements.
- Manual semantic samples: literal entity types such as 중소기업/소상공인 and explicit industry,
  business-age, financing, and factory-operation clauses were classified as verified. “관내” was
  normalized to a named municipality only as inferred. The previously empty 양주시 record now
  produced entity, industry, and inferred region requirements.
- Limitation: source material is currently Bizinfo API summary/target/application text, not yet
  attached PDF/HWPX content. A sample of three cannot establish recall, confidence calibration, or
  semantic entailment across 1,500+ active programs.

Safe operator command (the environment file remains private and gitignored):

`ELIGIBILITY_ENV_FILE=/absolute/private/.env.local npm run backfill:eligibility:sample -- 3`

Do not raise the hard cap or loop this command as a substitute for the reviewed T2 batch process.

### 25-program pilot (2026-08-24)

The approved pilot used concurrency 1, no automatic retry, a 20,000-character per-program source
limit, and a conservative 250,000-token ceiling. The first attempt stopped after six successes and
one persistence failure because a model item omitted `value`; the resulting SQL null violated the
schema. The extraction validator now rejects missing/null values and has regression coverage. An
explicit resume processed only the remaining 19 candidates while carrying forward prior usage.

Final observed state: 25/25 latest v2 runs succeeded; 98 requirements comprise 84 verified and 14
inferred rows; observed model usage was 24,964 tokens. Read-only SQL found zero null values, invalid
confidence values, or verified citations whose stored offsets failed to reproduce the exact quote.
No invoice amount is inferred from token telemetry; the token ceiling is a safety guard, not a
provider billing statement.

The semantic gate did not pass. Review found verified normalizations broader than the cited phrase,
an application submission instruction mis-typed as an exclusion, and inferred exclusions that
merely negated already-recorded positive rules. These rows remain review evidence, not approved
matching facts. Broad/controlled backfill stays stopped pending a tightened, versioned extraction
contract and a new 1–5 gate sample.

Extractor v4 follow-up (2026-08-25): the validator now rejects inferred exclusions, rejects
application-procedure exclusions, and accepts exclusions only when the exact quote contains explicit
negative language. For every verified requirement, the user-facing normalized text is replaced with
the exact evidence quote so the displayed claim cannot exceed its citation. A targeted rerun of the
five known-defect programs produced 15 requirements (14 verified, one inferred), zero exclusions,
zero invalid offsets, and zero verified rows whose display text differed from the evidence quote.
This passes the 1–5 gate sample; a new controlled pilot remains required before broad population.

## Production smoke record (2026-08-23)

- `https://www.eunwon.com/`, `/login`, `/signup`, and `/contact` returned 200.
- `/dashboard`, `/dashboard/saved`, and `/settings/notifications` returned 307 to `/login` with the
  intended `next` parameter when unauthenticated.
- An unknown route returned 404. `/events` also returned 404, consistent with the Events UI remaining
  uncommitted/not production-released in this worktree.
- `/api/cron/sync-events` and the configured `/api/cron/notify-users` route each rejected an
  intentionally invalid bearer token with 401 and did not run. No notification job or email ran.
- Authenticated mutation flows and delivery were not exercised: there was no reusable production
  browser session, and this smoke deliberately avoided changing even designated test-account state.

## Authenticated production acceptance (2026-08-24)

- Signed in with the designated showcase test account; the populated business profile loaded 50
  credible matches and AI-prioritized recommendations without console errors.
- Saved the highest-ranked recommendation, observed the saved count update, opened the saved-program
  workspace, transitioned it from `considering` to `preparing`, and persisted a test-only next action
  and due date. The status history recorded the transition.
- The chosen notice had no populated eligibility evidence, so the preparation checklist correctly
  presented its explicit unavailable/empty state and manual-item path rather than inventing documents.
- `/events` rendered 200 profile-ranked events with filter controls and source links. Notification
  settings rendered independent opportunity, saved-program, and saved-event controls. No emails,
  cron jobs, payments, or customer accounts were exercised.
- Direct navigation to billing and document placeholder settings succeeded. Earlier RSC-prefetch
  errors were stale/cumulative browser logs rather than repeatable route failures.
