# Customer beta readiness audit

Last updated: 2026-08-23

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

1. Define and execute the reviewed batch/backfill operating policy before corpus-wide evidence
   population. A three-program observed sample now passes, but the remaining program corpus has
   not been reviewed or backfilled.
2. Deploy the current repository revision, then run authenticated smoke tests on the production
   domain for the complete primary journey and both email categories. Local UI verification does
   not prove deployment or email delivery.
3. Decide and mitigate the intentionally public `email_is_registered` account-enumeration surface
   (rate limit/abuse protection or remove live checking). The Supabase advisor flags its anonymous
   `SECURITY DEFINER` execution.
4. Enable Supabase leaked-password protection in deployment configuration. This audit did not
   change external auth settings.

## Evidence matrix

| Area | Status | Evidence and remaining work |
|---|---|---|
| Authentication and route protection | Pass with risk | App layout and pages re-check the session server-side. API mutations authenticate and scope ownership. Middleware matcher omits `/events`, but the Events server page still redirects unauthenticated users; add it for consistent early redirects. Public email lookup remains an enumeration risk. |
| Onboarding and profile | Pass (code) | Signed-in onboarding/profile routes, validation, empty/error feedback, and responsive controls exist. Re-run production-domain smoke test after deployment. |
| Credible matching | Partial | Existing deterministic matching and AI explanations remain. A bounded three-program production evidence run produced 12 v2 requirements: 11 verified, one inferred, with every quote exactly present in its stored source. This sample does not establish corpus-wide evidence quality or populate all programs. |
| Saved programs and tracker | Pass | Eight-stage atomic transition, ownership check, history, next action/date, outcomes, notes, and empty state are implemented. Anonymous RPC execution is explicitly revoked; authenticated execution remains intentional and ownership-checked. |
| Preparation checklist | Pass, data-dependent | User-owned RLS table and API support source snapshots, completion, manual items, verified/inferred distinction, confidence, exact quote, source link, and resilient states. Manual items cannot claim stored citations. Automatic items are available for the sampled programs; other programs remain unavailable until their evidence is populated. |
| Notification preferences | Pass (code) | Opportunity briefing, saved-program deadline reminders, and event reminders have independent controls and configurable lead times. Digest selection is capped/deduplicated and tested; deadline reminders are preserved. Production delivery still needs a post-deploy bounded smoke test. |
| Events | Partial | 308 active production event rows exist; discovery, profile/category relevance, save, distinct reminders, source links, and ICS are implemented/tested. `event_sync_runs` has no rows yet, so the enhanced importer health path has not been observed in production. |
| Calendar | Pass for provider-free phase | Event ICS and saved-program deadline ICS use all-day dates, exclusive end dates, stable IDs, Korean-safe line folding, canonical URLs, private/no-store authenticated download, and deterministic tests. Google OAuth sync remains a later consented phase. |
| Sharing | Partial | Native Web Share with copy fallback exists. Program detail pages are authenticated and the current payload uses the browser URL, so the roadmap's canonical public-share promise is not complete. Never add match/profile/application details to shares. |
| Errors and empty states | Pass with follow-up | Main dashboard, saved list, events, checklist, forms, and not-found states are present. Checklist/API failures are user-safe. Contact/notification Resend construction was moved to request time so absent local secrets no longer break builds. Add route-level `error.tsx` boundaries for finer recovery. |
| Accessibility and mobile | Pass for changed flows | UI uses semantic sections/lists, labels, live regions, focus rings, 44px mobile targets, keyboard-native controls, and responsive layouts. Checklist was inspected at 1280×900 and 390×844 with no overflow or console errors. Full WCAG assistive-technology regression remains a pre-broad-launch task. |
| RLS and database security | Pass for new schema; legacy findings | Migrations 011-017 are live. New user-owned checklist has four owner policies and indexed FKs. Eligibility writes are service-only. Advisors still report older RLS init-plan performance warnings, public `email_is_registered`, intentional authenticated tracker SECURITY DEFINER execution, and leaked-password protection disabled. |
| Production build | Pass | `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass after lazy Resend initialization. Build produced 27 pages/routes. |
| Payments | Not exercised | Billing routes and recurring charge cron were not invoked or modified, per scope. Validate separately only with explicit financial test authorization and provider-safe fixtures. |

## Verification record

- Unit suite: 25 deterministic tests after adding the zero-result extraction failure case.
- Static checks: Next ESLint and TypeScript pass.
- Production build: Next.js 14.2.35 optimized build passes.
- Supabase: migrations 011, 015, 016, and 017 applied in this phase; migrations 012-014 had already
  been applied. New table RLS/policies/indexes and function grants verified by catalog queries.
- Advisor references:
  [database linter](https://supabase.com/docs/guides/database/database-linter),
  [RLS performance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select),
  [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Recommended next sequence

1. Add mocked persistence retry/cache tests and define batch size, review sampling, failure threshold,
   and rollback/stop rules before any broader T2 backfill.
2. Production-domain smoke test for the primary journey and notification delivery after deployment.
3. Close critical security/configuration gates above.
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
