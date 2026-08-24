# Next-stage product roadmap

Last updated: 2026-08-23

This document is the resumable delivery plan for the post-MVP product. It deliberately does not
re-plan features that already exist: saved programs, 7/3/1-day email reminders, personalized
"why this matches" explanations, and the saved-program workspace.

## Delivery principles

- Eligibility facts are imported once and reused. Runtime matching must not need to re-read a
  notice or call an LLM.
- Every machine-extracted requirement must point to a stored source and an exact evidence quote.
  A fact without valid evidence is `inferred`, never `verified`.
- Confidence describes extraction certainty, not applicant eligibility.
- Raw sources are immutable by content hash. Re-processing is keyed by source fingerprint and
  extractor version so prompt/model changes are auditable.
- HTML, PDF, and HWPX are first-class inputs. Legacy binary HWP is explicitly deferred until a
  working parser/conversion service and fixture-based tests exist.
- Existing flattened `programs.required_*` columns remain available while consumers migrate to
  normalized requirements.

## Sequenced tasks

### Phase 1 — Trustworthy eligibility foundation (in progress)

#### T1. Evidence data model and extraction contract — complete in repository

Dependencies: none.

- Data: add `program_source_documents`, `program_extraction_runs`, and
  `program_eligibility_requirements`. Store source URL/type/hash/text, extractor/model/version,
  source-set fingerprint, normalized requirement, confidence, verification state, exact quote,
  and source offsets when available.
- API/pipeline: define a typed extraction contract and reject unknown requirement types,
  out-of-range confidence, missing sources, and evidence quotes not present in source text.
- UI: none in this task.
- Tests: deterministic unit fixtures cover verified, inferred, invalid citation, and stable hashing.
- Acceptance: the database can reconstruct who/what/when produced every requirement; invalid
  evidence cannot be persisted as verified.

Production status (2026-08-23): migration `011_add_eligibility_evidence.sql` was preflighted and
applied through the connected Supabase migration API. Tables, indexes, RLS, public read policies,
and service-only mutation permissions were verified. Migration `015_beta_schema_hardening.sql`
explicitly removed anonymous tracker-RPC execution and non-service eligibility writes; migrations
`015` and `016` added the new FK indexes identified by the post-migration advisor. The import
path and deterministic evidence validator pass local tests. Existing production rows will acquire
normalized evidence on a subsequent successful program sync; no bulk AI backfill was invented or
triggered as part of schema deployment.

#### T2. Import-time HTML/text extraction and reuse — v4 gate passes; controlled pilot pending

Dependencies: T1.

- Data: write the 기업마당 summary, target, and application-method fields as source documents.
- API/pipeline: upsert raw program data first, fingerprint sources, reuse a successful extraction
  with the same fingerprint/version, otherwise make one structured AI call and persist validated
  results. Update legacy flattened columns in the same import for compatibility.
- UI: none.
- Tests: mocked importer proves unchanged sources skip AI, changed sources create a new run, and a
  failed extraction leaves the prior successful facts intact.
- Acceptance: nightly sync does not re-bill unchanged notices; every new normalized fact is cited.

Implemented so far: API text sources are persisted and hashed; normalized eligibility extraction
is cached by fingerprint/version; citations are validated before persistence; failed runs preserve
prior successful data. Remaining: consolidate the older flattened enrichment call with this cache
so unchanged notices skip all eligibility-related AI work (currently only the normalized,
source-backed extraction is skipped). Mocked persistence coverage now proves successful cache reuse,
retry of a non-successful same-version run, run-scoped cleanup, and preservation of prior facts when
extraction fails. The reviewed batch/review/stop policy is documented in
[`eligibility-backfill-runbook.md`](./eligibility-backfill-runbook.md). The approved 25-record pilot
has now run under that policy. Remaining: tighten the semantic extraction contract, repeat the gate
sample, and consolidate the older flattened enrichment call.

Observed sample (2026-08-23): the bounded `backfill:eligibility:sample` command has a hard maximum
of five programs and was run against three active production records using the existing private
environment. Version 1 created three sources/run per program and exposed two quality gaps: one
non-empty target silently produced zero requirements, and one normalization needed stronger
verified/inferred instructions. Version 2 now rejects a zero-result extraction when a target source
exists and explicitly requires the complete normalized meaning to be supported by the quote. The
same three-record rerun produced 12 requirements (11 verified, one inferred); all 12 stored quotes
were exact substrings of their stored sources, and the previously empty program produced three
requirements. Confidence ranged from 0.900 to 1.000 and continues to mean extraction certainty,
not applicant eligibility. This is evidence of a small observed path, not approval for bulk
backfill or proof of quality across the full corpus.

Read-only revalidation on 2026-08-23 confirmed the latest state remained 3/3 successful v2 runs,
12 requirements (11 verified, one inferred), zero invalid verified citations, and zero latest-run
errors. This closes the bounded sample quality follow-up, not the broader evidence-population task.

Pilot observation (2026-08-24): a bounded 25-program runner added explicit acknowledgement,
concurrency 1, no retries, source-size limits, observed token accounting, a 250,000-token ceiling,
and resumable prior-usage accounting. Its first attempt correctly stopped at a 14.3% failure rate
after a missing model `value` reached the non-null JSON column. The validator now discards missing
or null values, and the explicitly resumed run completed the remaining records. Final state was
25/25 succeeded, 98 requirements (84 verified, 14 inferred), 24,964 observed tokens, and zero
structurally invalid citations or confidence values.

The semantic review did not pass: exact substring validation alone allowed some normalized claims
to exceed the meaning of their quote, a submission instruction was classified as an exclusion, and
some inferred exclusions redundantly negated positive rules. Therefore no larger backfill is
authorized. Next T2 action is a version bump with stricter entailment/type rules followed by a new
1–5 gate sample; the existing pilot rows are retained as review evidence.

Version 4 follow-up (2026-08-25): inferred and procedural exclusions are deterministically dropped;
explicit exclusions require a verified quote with negative language; and verified display text is
the exact evidence quote, preventing a model summary from broadening a cited statement. The targeted
five-program rerun of known defects produced 15 requirements (14 verified, one inferred), no
exclusions, no invalid offsets, and no verified display/citation differences. The gate sample passes.
Run a newly approved controlled pilot before any broad population; v2/v3 rows remain audit evidence.

#### T3. Notice-page and attachment acquisition

Dependencies: T1-T2.

- Data: add fetch status, HTTP metadata, attachment filename/MIME, and parent-source linkage.
- API/pipeline: fetch notice HTML with timeout/size/domain controls; discover attachments; extract
  PDF text and HWPX XML text; retain the original URL and content hash. Retry transient failures.
  Treat scanned PDFs as unsupported until OCR is separately selected.
- UI: admin/import diagnostics only.
- Tests: checked-in HTML, PDF, and HWPX fixtures; SSRF/oversize/timeout cases.
- Acceptance: each supported fixture yields stable source text and citations. `.hwp` is recorded as
  unsupported, not silently treated as extracted.

#### T4. Eligibility review and backfill

Dependencies: T3.

- Data/API: resumable backfill cursor; reviewer override with actor/time/reason; never overwrite a
  manual decision during re-extraction.
- UI: internal review queue for low-confidence/inferred/conflicting requirements.
- Tests: backfill restart, override preservation, RLS/admin access.
- Acceptance: operators can review and correct facts and trace every revision.

### Phase 2 — Application execution

#### T5. Application status tracker v2 — complete in repository

Dependencies: none; extends existing `saved_programs.status`.

- Data: status history (`considering`, `preparing`, `submitted`, `screening`, `interview`,
  `selected`, `rejected`, `withdrawn`), submitted date, next action/date.
- API/UI: atomic transition endpoint; timeline and quick update in saved workspace.
- Tests/acceptance: valid transition history, user-only RLS, keyboard/mobile operation, existing
  saved statuses migrated without loss.

Implemented: migration `012_application_tracker_v2.sql` maps existing saved/application states,
adds eight lifecycle states, submitted date, next action/date, an RLS-protected history table, and
an ownership-checked atomic transition function. Authenticated API routes validate transitions and
detail edits. The saved workspace now shows a responsive progress indicator, current-state control,
recent timeline, next action/date, and resilient save/error feedback while preserving outcomes,
notes, deletion, the saved-program redesign, and existing reminder behavior.

#### T6. What-to-prepare checklist — complete in repository and production schema

Dependencies: T1, T5.

- Data: migration `017_saved_program_preparation_checklist.sql` stores user-owned item state and
  immutable evidence snapshots linked to normalized source requirements. RLS enforces ownership;
  source-backed inserts must match the saved program and stored requirement, while manual items
  cannot claim citations.
- API/UI: on first view, copy the latest successful extraction into the saved-program checklist;
  allow user additions, completion toggles, and deletion. Show separate verified, inferred, and
  user-added states, exact evidence excerpts, source links, extraction confidence, and pending/
  unavailable source states without presenting them as eligibility certainty.
- Tests/acceptance: deterministic mapper tests cover citations, inferred content, confidence bounds,
  and unsafe URLs. User completion is stored independently from extraction runs, so later template
  changes cannot erase it; manual items are always labeled as user-added.

#### T7. Deadline urgency and calendar

Dependencies: T5.

- Phase 1 — no-account calendar export: add a per-saved-program `.ics` download containing the
  program title, canonical public/detail URL, agency, and application deadline. Use an all-day
  `VALUE=DATE` event for date-only deadlines so timezone conversion cannot move it to the prior
  day; omit export for unknown/open-ended deadlines; escape/fold ICS fields and use a stable UID.
  This requires no third-party connection or calendar permission and should sit beside the saved
  program's next action/deadline controls.
- Phase 2 — optional Google Calendar sync: user-consented OAuth with the minimum Calendar scope;
  explicit connect/disconnect and per-event sync controls; encrypted server-side tokens; event ID,
  calendar ID, sync version/hash, last result/error, and ownership in an RLS-protected table. Create,
  update, and remove events idempotently; prevent duplicates by stable local identity; reconcile
  program deadline/title/URL and user reminder changes; handle refresh failure, revoked consent,
  deleted remote events, and disconnect without silently deleting unrelated calendar content.
- Data/UI: retain optional personal target date and calendar-event identity. Calendar reminders are
  distinct from email cadence; users choose them explicitly. Explain what data Google receives and
  whether disconnect leaves or removes eunwon-created events.
- Security/privacy: OAuth state/PKCE and redirect validation, least scope, tokens never sent to the
  browser or logs, server-only event mutations, user-only RLS, audit/revocation handling, deletion
  and retention policy. No background calendar connection is implied by downloading an ICS file.
- Tests/acceptance: deterministic ICS fixtures validate CRLF/folding/escaping, Korean text, stable
  UID, canonical URL, and Asia/Seoul/date-only behavior in major calendar clients. Google phase tests
  consent denial/revocation, cross-user denial, duplicate retries, changed deadlines/reminders,
  remote deletion, disconnect policy, token redaction, and partial provider failure.

Phase 1 implementation status (2026-08-23): complete in repository for both saved programs and
saved events. Authenticated, ownership-scoped downloads emit private/no-store RFC 5545 files with
stable UIDs, canonical program/event URLs, Korean-safe folding, and date-only all-day semantics.
The optional Google Calendar OAuth phase remains planned and is not implied by an ICS download.

#### T8. Notes and collaboration

Dependencies: T5; organization/account model decision.

- Data: threaded notes, mentions, memberships, roles, audit log.
- API/UI: comments/activity panel and permissions.
- Tests/acceptance: tenant isolation, mention notification, edit/delete audit semantics.

### Phase 3 — Better decisions

#### T9. Business-profile gap analysis — complete in repository

Dependencies: T1.

- Data/API: evaluate normalized requirements against profile fields with `met`, `not_met`, or
  `unknown`; include missing profile fields and cited program rules.
- UI: actionable gaps, separating profile incompleteness from actual ineligibility.
- Tests/acceptance: deterministic rule matrix; no unknown treated as eligible or ineligible.

Implementation status (2026-08-25): the program detail page loads the latest successful current-
version requirement set and evaluates only compatible structured fields. It distinguishes `met`,
`not_met`, and `unknown`; inferred rules, unsupported exclusions, missing profile values, city-level
rules against province-only profiles, and SME-class rules against legal-form profiles remain
`unknown`. The UI separates missing profile data from mismatches, links to profile completion, shows
verified/inferred provenance and citations, and states that the comparison is not an eligibility
decision. The deterministic matrix covers satisfied, mismatched, missing, inferred, unsupported,
numeric-unit, and incompatible-vocabulary cases.

#### T10. Match confidence and explanation v2 — complete in repository and schema

Dependencies: T9.

- Data/API: persist score components, evidence coverage, freshness, and rule version.
- UI: score breakdown and uncertainty language; retain existing explanation feature.
- Tests/acceptance: reproducible score and calibration dataset; explanations never contradict
  hard eligibility rules.

Implementation status (2026-08-25): `program_match_assessments` stores immutable, owner-scoped
snapshots keyed by rule/input fingerprint, including evidence coverage, comparable-profile coverage,
uncertainty, freshness, result state, component counts, and source/profile/program timestamps. RLS
permits authenticated users to read/insert/delete only their own rows; anonymous access is revoked
and all FKs are indexed. The deterministic `match-confidence-v1` score is explicitly data quality,
not eligibility or selection probability. Any known T9 mismatch controls the result state regardless
of score. The UI shows component breakdown and freshness before T9 details. AI explanation remains a
secondary Pro feature; it receives the same gap evidence, cannot promote unknown facts, and returns
deterministic caution without a model call when a hard mismatch exists. The calibration dataset is
the versioned snapshot table; outcome calibration remains dependent on T15 feedback.

#### T11. Program comparison — complete in repository

Dependencies: T6, T7, T10.

- Data/API: comparison projection for 2-4 program IDs.
- UI: aligned eligibility, benefit, deadline, documents, gaps, and confidence table.
- Tests/acceptance: URL-shareable selection, missing values shown as unknown, mobile fallback.

Implementation status (2026-08-25): dashboard users can select 2–4 programs without affecting save
or explanation actions, remove/clear selections, and open an authenticated `/compare?ids=...` URL.
The server validates and deduplicates UUIDs, preserves selection order, scopes saved/checklist data to
the signed-in owner, and projects the same T9/T10 eligibility state and quality score. Desktop uses a
semantic aligned table; mobile/tablet uses program cards. Eligibility, data quality, benefit,
deadline, checklist progress, application stage, and next action are compared. Missing fields always
say `확인 필요`; a known mismatch remains authoritative; external apply links are protocol-checked.
Deterministic tests cover URL bounds/deduplication and mismatch/unknown projection semantics.

#### T12. Duplicate-benefit detection v2 — complete in repository

Dependencies: T1, T5.

- Data/API: extract cited restriction clauses and compare benefit period/purpose/funding source
  against selected/submitted applications; replace the current category-only heuristic.
- UI: warning with source and “needs confirmation”, never a definitive legal conclusion.
- Tests/acceptance: known conflict/non-conflict fixtures and conservative ambiguous result.

Implementation status (2026-08-25): the prior same-category-only warning has been removed. Detection
now requires a current-version, verified exclusion clause containing explicit duplicate/same/similar
benefit language and compares it with the signed-in user's submitted-through-selected applications.
Agency, category, funding type, and title overlap affect whether the result is `possible_conflict` or
`needs_confirmation`; they cannot create a warning without cited restriction evidence. The UI names
the prior program, quotes and links the clause, and states that the result is not a legal or
eligibility conclusion. Tests cover evidence-backed overlap, ambiguous unrelated history, ordinary
non-duplicate exclusions, inferred clauses, and the absence of a cited rule.

#### T13. Similar-program recommendations — complete in repository

Dependencies: T10.

- Data/API: candidate retrieval from structured attributes, then rank by eligibility and semantic
  similarity; exclude closed/current program and explain differences.
- UI: similar programs on detail and closed-program replacement state.
- Tests/acceptance: all recommendations pass hard filters; ranking evaluation set is versioned.

Implementation status (2026-08-25): detail pages retrieve up to 100 candidates through the existing
hard region/entity/age/employee/revenue/deadline eligibility query, then exclude the current,
inactive, and closed programs before deterministic ranking. Category, funding type, agency, region,
target type, structured tags, and title terms contribute to a capped similarity score. Cards explain
shared signals and concrete differences, link directly to each program, and label similarity as
distinct from eligibility. The checked-in deterministic fixtures are the initial versioned ranking
evaluation set; outcome-based tuning remains dependent on T15.

### Phase 4 — Assisted application

#### T14. Document vault

Dependencies: storage/security/retention decisions; table shell already exists.

- Data/API: private Supabase Storage bucket, metadata, versions, malware/type/size checks, signed
  access, deletion/retention workflow.
- UI: upload, categorize, replace, preview metadata, reuse in checklist.
- Tests/acceptance: RLS and cross-user denial, expired links, deletion, file-validation fixtures.

#### T15. AI application plan and drafting

Dependencies: T6, T9, T14.

- Data/API: prompt/run provenance, user-approved source selection, section drafts and revisions;
  cite program requirements and distinguish user facts from suggestions.
- UI: plan first, section editor, missing-evidence warnings, explicit regenerate controls.
- Tests/acceptance: no invented company facts in adversarial fixtures; private documents are only
  used for the owning user; existing simple generator remains until migration is complete.

#### T16. Application-summary export

Dependencies: T5-T7, optionally T15.

- Data/API: server-side export snapshot and template version; PDF first, DOCX after template QA.
- UI: export action and preview containing status, deadline, checklist, gaps, notes, and sources.
- Tests/acceptance: Korean font/render fixture, deterministic snapshot, no private signed URLs.

### Phase 5 — Learning and retention

#### T17. New and better-match alerts

Dependencies: T10, notification preference/frequency decision.

- Data/API: match snapshots and deduplicated alert events for newly opened or materially improved
  scores; integrate with—not duplicate—the current deadline/new-match notification job.
- UI: digest preferences and reason for alert.
- Tests/acceptance: threshold, dedupe, quiet-frequency, and unsubscribe behavior.

Implemented notification foundation: `013_split_notification_preferences.sql` separates the daily
opportunity briefing from saved-program deadline reminders and preserves existing opt-in defaults.
Users independently toggle each service and select common deadline lead times. The daily cron ranks
unseen actionable programs using strong cached AI fit plus deterministic profile match, displays a
configurable five-item digest with direct service links, and records the full evaluated unseen set
only after successful delivery so unchanged overflow does not repeat. Better-match re-alerts remain
future work because they require versioned match snapshots rather than the current one-time program
dedupe.

#### T23. Privacy-safe program sharing

Dependencies: canonical public program URL/indexability decision from T19; source-backed public
summary from T1-T4. Sequenced after the active notification work.

- Phase 1 — resilient browser sharing: add an accessible share button using `navigator.share` when
  available and a copy-link fallback on desktop/unsupported/cancel-safe paths. Share only canonical
  public program URL, title, agency, and a concise source-backed public summary. Never include the
  signed-in user's profile, match score/reason, eligibility gaps, save/application state, notes,
  referral secrets, or private query parameters. Provide live success/error feedback and keyboard/
  screen-reader operation; copying still works when clipboard permission is unavailable via a
  selectable/manual fallback.
- Public-page implications: a shared link must resolve without leaking authentication context. If
  program details remain authenticated, create a deliberately public, canonical, minimal program
  page or a privacy-safe preview route with correct canonical/robots/metadata policy; do not make
  private match pages indexable merely to support sharing. Social metadata/cards are derived from
  public source-backed fields and handle closed/stale programs explicitly.
- Phase 2 — KakaoTalk: configure a Kakao Developers app, allowed JavaScript domains/redirect origins,
  and the Kakao JavaScript SDK with the least required capability. Use a reviewed feed/custom share
  template containing canonical URL, public title/agency/deadline/summary, safe preview image, and
  “지원사업 보기” action. Initialize safely, detect SDK/config/ad-block failures, and always retain
  native/copy fallback. Keep Kakao app keys public-only as designed; admin keys/secrets stay server-
  side and out of bundles/logs.
- Attribution: if product policy adopts conversion attribution, use a non-personal campaign/source
  marker or short-lived opaque share ID with consent/retention rules. Never encode user/business ID
  or profile attributes in the URL. Attribution failure must not break navigation.
- Acceptance: shared/copied URLs are canonical and usable in signed-out/private browsing; automated
  checks prove rendered share payloads/metadata contain no profile, score, notes, saved state, or
  secrets. Native-share success/cancel/error and clipboard/manual fallbacks work across supported
  mobile/desktop browsers. Kakao phase validates domain/template configuration, Korean card preview,
  fallback without SDK, closed-program handling, safe attribution, and direct navigation.

#### T24. Bizinfo events discovery and action loop — complete in repository

Dependencies: live Bizinfo Events API credential/response validation; shared notification preference
and dedupe primitives from T17; provider-free ICS foundation from T7. This is complementary to
support-program matching and follows the active notification fix.

Current baseline: migration `006_add_events.sql`, `lib/sync/syncEvents.ts`, the protected nightly
`/api/cron/sync-events` route, manual `sync:events` script, region/upcoming query, dashboard 행사 tab,
and event cards already exist. However, the importer explicitly has not been verified against a live
Events API key/response, so this baseline is considered partial rather than production-active.

Implementation order after notification v2 ships:

1. Add deterministic importer fixtures, run-health records, structured failure reporting, and safe
   crawl/deactivation tests; then validate the fixture contract against a credentialed live response
   when `BIZINFO_EVENT_API_KEY` is available. Absence of the key blocks only live validation, not
   local deterministic implementation, and must be reported rather than replaced with guessed data.
2. Normalize missing registration/location/update fields and implement profile/category-aware
   relevance with a versioned pure ranking test matrix while preserving current region/date behavior.
3. Build the dedicated filterable events/explore surface on top of that compatible query.
4. Add RLS-protected saved events and explicit event notification preferences/history, reusing the
   notification v2 delivery/dedupe pattern without mixing event and program notification categories.
5. Add provider-free event/registration `.ics` export and complete end-to-end accessibility,
   privacy, retry, reminder, and calendar fixtures.

Implemented: migration `014_events_mvp.sql` adds normalized registration/location/online/source-hash
fields, service-only sync health runs, RLS-protected saved events, independent event reminder
preferences, and event reminder dedupe. The importer now follows the credential-validated live
`jsonArray` contract and observed field names, while retaining deterministic local fixtures; bounded
crawl tests prevent truncated/capped responses from deactivating unseen data. A minimal two-row live
request using the existing private saved-checkout credential returned HTTP 200 and both rows passed
normalization; no key or event values were logged or persisted during validation.

Profile relevance now considers local/online access, interest category, business-domain overlap,
and registration urgency. The authenticated `/events` surface provides search plus type/category/
region/registration/saved/date filters, relevance reasons, external registration/source links, and
RLS-backed saving. Saved events can export stable all-day RFC 5545 calendar files and opt into
separate registration-deadline/event-start reminders with configurable lead times and idempotent
delivery. Sync run counts/errors provide the foundation for T20 admin observability.

Deployment gate: apply migrations 012-014 in order and configure the already-issued
`BIZINFO_EVENT_API_KEY` in the deployment environment. The key exists only in the gitignored saved
checkout `.env.local`, not this worktree/process, which is intentional; do not copy or commit it.

- Ingestion: obtain/configure the separate `BIZINFO_EVENT_API_KEY`; capture a redacted real response
  fixture and confirm endpoint, envelope, external ID, pagination, event/application date formats,
  region/type/category/host, registration URL, and update semantics. Make the job idempotent,
  resumable, bounded, observable, and safe on partial failure; keep raw source attribution/freshness
  and dedupe by stable source identity plus conservative content fingerprint fallback.
- Normalized data: distinguish event occurrence dates from registration start/deadline; support
  online/hybrid/location when present, host, type (`교육`, `세미나`, `설명회`, `전시회`), category,
  source URL, registration URL, status/cancellation, fetched/updated timestamps, and extraction
  confidence for any inferred field. Never treat an event as a funding/support-program match.
- Discovery/ranking: hard-filter active/upcoming/registration-open events, then rank using profile
  region, industry/technology domains, current challenges/interests, format, date proximity, and
  evidence coverage. Label this “관련 행사” or “교육·세미나·전시” and explain relevance separately
  from eligibility/match scores.
- Product surface: evolve the existing dashboard tab into a filterable explore surface for type,
  category, region/online, registration-open state, and date; provide clear occurrence and
  registration deadlines, source/host attribution, direct registration and original-detail links,
  empty/error/freshness states, and profile-aware ordering.
- Saved events and actions: user-owned `saved_events` with notes/status and unique user/event pair;
  independent event-notification preference and configurable registration/event lead times; generic
  notification history/dedupe shared safely with T17 but distinct event categories/templates. Add
  provider-free ICS export for occurrence and/or registration deadline, then optionally reuse the
  consented Google Calendar architecture from T7 without broadening scope silently.
- Controls/privacy: users independently toggle event discovery emails/reminders; no automatic email
  merely because events exist. RLS protects saves/preferences/history; public event source data is
  readable only according to the public/indexing decision, and no profile attributes appear in
  outbound registration URLs or shared calendar descriptions.
- Acceptance: live fixture import yields stable normalized rows across retries and deactivates only
  after a complete successful crawl; malformed dates/envelopes cannot mass-deactivate data. Event
  and program records never collide or appear under the wrong UI promise. Ranking/filter fixtures
  are deterministic; registration links/deadlines and source attribution are correct. Cross-user
  saved-event access fails; reminders are preference-scoped, once-per-event/lead-time, and do not
  duplicate daily opportunity briefings. ICS fixtures preserve Korean text/date semantics.

#### T18. Outcome feedback and matching evaluation

Dependencies: T5, T10.

- Data/API: structured outcomes and rejection reasons, consent flag, anonymized evaluation export;
  start with offline evaluation rather than self-training production weights.
- UI: low-friction follow-up after a decision.
- Tests/acceptance: consent/deletion respected; dashboards detect score calibration drift.

### Phase 6 — SEO and answer-engine discoverability

#### T19. Korean SEO + AEO foundation

Dependencies: T1-T4 for trustworthy/citable program facts; final public-vs-authenticated page boundary;
analytics/search-console ownership. Technical auditing and content planning may begin earlier, but
mass indexation must wait for the dependencies.

- Technical SEO: establish canonical URL rules, XML sitemap partitioning, robots directives,
  pagination/filter handling, redirects, crawl-error monitoring, and explicit indexability for
  public marketing/program pages. Keep profile, saved, generated-document, and account routes out
  of search indexes.
- Korean information architecture: define search-intent clusters in natural Korean (지원대상,
  지역, 업종, 업력, 지원유형, 신청기간, 준비서류), hub/detail relationships, breadcrumbs, and
  editorial ownership. Avoid creating every possible facet combination.
- Content strategy: maintain useful evergreen guides and curated category/region pages with a
  clear user question, original explanation, update owner/date, and links to live cited programs.
  Define retirement/redirect rules when notices close.
- Structured data: emit valid `Organization`, `WebSite`, `BreadcrumbList`, and, only where the
  visible content qualifies, `FAQPage` structured data. Represent program facts with the closest
  valid schema vocabulary without inventing eligibility or award claims. Validate JSON-LD in CI.
- Metadata: unique Korean title, description, canonical, Open Graph, and social image strategy;
  stable fallbacks for incomplete imports; no keyword stuffing.
- Programmatic landing-page safeguards: require a minimum number of active programs plus unique
  editorial value before indexation; canonicalize or `noindex` empty/near-duplicate facets; exclude
  internal search results; detect title/body similarity, soft-404s, and stale pages in CI/jobs.
- Performance: set Core Web Vitals budgets, minimize client JavaScript on public pages, optimize
  fonts/images, and measure representative Korean mobile pages using field data when available.
- Trust and citations: display responsible agency, original notice link, evidence-backed eligibility
  excerpts, extraction verification/confidence language, last checked date, correction path, and a
  clear disclaimer. Preserve citations in server-rendered HTML.
- AEO question-answer content: answer one concrete user question near the top of each eligible
  page in concise Korean, then provide cited details, exceptions, preparation steps, and related
  questions. Generate drafts from normalized facts but require deterministic citation validation;
  never publish unsupported AI prose as a verified answer.
- Measurement: baseline indexed pages, impressions/clicks, branded/non-branded queries, rich-result
  validity, crawl waste, answer-engine referrals where observable, and conversion to signup/save.

Tests and acceptance criteria:

- Public/auth route indexability matrix is documented and verified against rendered responses.
- Every indexable URL has a self-consistent canonical and unique metadata; sitemaps include only
  canonical, useful, 200-status pages and update predictably.
- Structured data passes schema validation and matches visible content; FAQ markup is not emitted
  for hidden, generated-only, or ineligible content.
- No facet page is indexable unless it meets the documented inventory/editorial threshold. Empty,
  expired-only, thin, and substantially duplicate pages become `noindex`, canonicalized, retired,
  or redirected according to policy.
- Representative public templates meet agreed Core Web Vitals/performance budgets on mobile and
  render primary Korean answer content without client-side JavaScript.
- Sampled eligibility/answer claims link to stored first-party notice sources and pass the T1
  evidence validator; unsupported or inferred claims are visibly labeled.
- A pre/post dashboard and monthly audit owner are in place before programmatic expansion.

Primary risks and mitigations:

- Thin/duplicate program or facet pages can waste crawl budget and reduce site quality: gate
  indexation on inventory, uniqueness, and cited editorial value; continuously similarity-audit.
- Closed or changed notices can surface stale answers: show freshness, revalidate sources, retire
  predictably, and never remove the original-source trail.
- Invalid or misleading structured data can trigger manual actions: derive it from visible facts,
  validate in CI, and omit types/properties that do not fit.
- AI-written Korean can sound authoritative while being wrong: constrain answers to normalized
  cited facts, label inference, and provide correction/escalation paths.
- Large programmatic page sets can harm performance and operations: launch limited clusters,
  measure indexation/conversion, and expand only after quality gates hold.

### MVP operations workstream — Admin workspace

#### T20. Secure admin operations workspace (required before broad launch)

Dependencies: authentication role model and named initial operators; T1-T4 for extraction review;
payment-provider exception policy; data-retention and support-access policy. This workstream runs in
parallel with late MVP work, but does not displace the immediate T5-T7 user journey.

Staged rollout:

1. **Stage A — access and audit foundation:** store admin roles separately from user-editable
   profiles; default-deny middleware/server authorization; step-up authentication decision; append-
   only admin audit events; local/staging authorization tests. No production admin pages before
   this gate passes.
2. **Stage B — read-only operations:** user lookup by exact email/ID/business number with masked
   list results; account/profile/onboarding context; subscription/payment state and notification
   delivery status; program sync/extraction health; basic aggregate operational metrics. Avoid
   exposing full documents, generated drafts, payment credentials, or unnecessary personal data.
3. **Stage C — controlled corrections:** review source-backed eligibility requirements, compare
   evidence, and create explicit reviewer overrides with reason and revision history. Retry failed
   imports/notifications through bounded server actions. Never silently rewrite raw source text.
4. **Stage D — exceptional support actions:** carefully scoped subscription/payment exception
   workflows (for example retry guidance, entitlement correction, or cancellation state) with
   confirmation, reason, idempotency, and dual approval for high-risk actions where warranted.

Scope and contracts:

- Access: roles such as `support_readonly`, `content_reviewer`, `billing_operator`, and
  `admin_owner`; enforce capability checks in server code and database policies, not hidden UI.
  Service-role credentials stay server-only and are never the authorization mechanism for a human.
- User support context: exact lookup, masked search results, identity/account timestamps, profile
  completeness, saved/application state, and recent errors needed for support. Record every view of
  sensitive detail with actor, purpose/reason, target, time, and request correlation ID.
- Billing: show provider customer/payment identifiers only in masked form, current entitlement,
  last charge result, and exception state. Never store or display card numbers, secrets, billing
  keys, webhook secrets, or raw provider payloads containing unnecessary personal data.
- Import/extraction health: latest sync runs, counts/duration/failures, source-fetch/extractor
  version, evidence coverage, low-confidence/inferred queue, and retry/backfill controls with
  concurrency limits and idempotency.
- Eligibility moderation: corrections are separate, versioned reviewer overrides referencing the
  original requirement/source quote; require a reason and preserve extraction history.
- Notifications: per-user preference and deduplicated delivery event/status/error context; bounded
  retry only when it cannot create duplicate mail. Do not reveal email content beyond support need.
- Audit: append-only actor/action/target/before-after-safe-summary/reason/IP-or-request metadata;
  redact secrets and sensitive free text; retention and export access are explicitly controlled.
- Metrics: aggregate signups, onboarding completion, match/save/application funnel, sync freshness,
  extraction success/evidence coverage, notification success, and subscription state. Enforce
  minimum cohort sizes or omit breakdowns that could identify individuals.

Security and RLS requirements:

- All admin tables and actions default-deny normal authenticated users. RLS policies call a stable
  server-controlled role/capability function; role assignment cannot be changed through profile
  update APIs or client Supabase calls.
- Every mutation re-authenticates/authorizes server-side, validates input, scopes the exact target,
  uses CSRF-safe same-origin server actions/routes, and emits an audit event in the same transaction
  where feasible.
- Use least privilege, short sessions/step-up for billing mutations, rate limits, masked logs, no
  cache of personalized admin responses, and explicit production access review/revocation.
- Support impersonation is out of scope for MVP. If ever added, it requires prominent indication,
  time bounds, consent/policy review, and complete audit coverage.

Acceptance criteria:

- A normal, unauthenticated, suspended, or wrong-role user cannot load admin data or invoke admin
  actions via UI, direct HTTP, RPC, or Supabase client; automated RLS/route tests prove it.
- Role assignment and revocation take effect promptly and are themselves audited; there is at least
  one break-glass recovery procedure that does not weaken routine authorization.
- Read-only operators can resolve common account, notification, and import-health support questions
  without seeing unneeded personal, document, or payment data.
- Eligibility corrections retain original source/extraction facts, require a reason, identify the
  reviewer, and survive re-imports.
- Billing and retry actions are idempotent, confirmation-gated, capability-scoped, and tested
  against duplicate webhook/job delivery and partial failure.
- Audit coverage is tested for sensitive reads and every mutation; audit records contain no secrets
  and cannot be edited by ordinary admins.
- Operational metrics have documented definitions/freshness and cannot be drilled down to expose a
  single user's personal or billing details.

#### T21. Per-user AI usage and cost ledger (required before broad launch)

Dependencies: stable feature/action taxonomy; model pricing configuration and effective dates;
workspace/account model decision for shared usage; T20 access/audit foundation for admin views.
This is an MVP operations requirement but is not foundational to T5, so implementation follows the
active end-to-end tracker work.

- Data model: append-only AI usage events with nullable `user_id` and `workspace_id`, a required
  attribution class (`user`, `workspace`, `system_import`, `admin_operation`), feature/action,
  provider/model, provider request ID when safe, input/output/cache-read/cache-write token counts
  when returned, estimated cost and currency, pricing-version reference, start/completion time,
  outcome/error category, and idempotency/correlation key.
- Attribution: user-triggered explanation/drafting/rating calls count toward that user's or future
  workspace's allowance. Shared nightly program import/extraction is `system_import`, is reported as
  product operating cost, and is never charged to whichever user happens to view the result.
  Admin/replay/backfill usage is separately attributable and excluded from customer allowances.
- Cost calculation: retain immutable model pricing rows with effective intervals; calculate an
  estimate from the provider's returned usage fields and pricing active at request time. Preserve
  unknown token/cost values rather than inventing zero. Reconciliation may append adjustments but
  must not rewrite the original event.
- Privacy: analytics never store raw prompts, completions, source notice text, uploaded documents,
  generated drafts, API keys, or provider payloads. Store only controlled feature identifiers,
  counts, timings, outcome categories, and a non-reversible correlation/idempotency value. Error
  summaries use an allowlist and must not include user or document content.
- Aggregation: daily/monthly per-user/workspace/action/model rollups for user-facing allowances,
  aggregate system/import cost, and T20 admin dashboards. Ledger remains the source of truth;
  rollups are rebuildable and clearly mark delayed/unknown provider usage.
- Limits and alerts: server-side preflight checks use a conservative allowance counter; atomic
  reservation/finalization prevents concurrent overspend; define soft warning, hard cap, admin cost
  anomaly, runaway import, and provider-usage-missing alerts. Failed requests release reservations
  according to a documented policy but retain their outcome event.
- Access/RLS: users can read only their own summarized allowance/usage, not raw provider IDs or
  internal cost/pricing data. Workspace roles are required for shared summaries. Ledger writes are
  server-only; billing/admin capabilities from T20 gate detailed cost views and exports. Normal
  users cannot update/delete ledger events or query another user's usage.
- Retention: keep fine-grained events only for the documented billing/support dispute window, then
  retain privacy-reduced aggregates for financial/product planning. User deletion detaches or
  pseudonymizes attribution as legally appropriate without corrupting required financial records;
  the policy and job are tested.

Acceptance criteria:

- Every production AI call site emits exactly one finalized usage event (plus an optional atomic
  reservation) for success, provider failure, timeout, and cancellation; retries are idempotent.
- Provider-reported input/output/cache token counts reconcile to sampled provider dashboards within
  a documented tolerance; missing usage is visible and never silently recorded as zero.
- Model pricing changes do not alter historical estimates, and cost aggregation is reproducible
  from immutable events and versioned pricing.
- User allowances include only correctly attributed user/workspace actions. Import-time extraction,
  cron/backfill, admin testing, and shared cache creation cannot consume an individual allowance.
- Automated inspection proves no prompt, completion, extracted source, generated draft, document
  content, credential, or sensitive raw error is persisted in the ledger or analytics logs.
- RLS/route tests prove cross-user/workspace denial and server-only writes; user-facing totals do
  not reveal internal prices unless product policy explicitly chooses to show them.
- Concurrent requests cannot exceed a hard limit beyond the documented reservation tolerance;
  warnings/caps and anomalous-cost alerts are tested with deterministic token fixtures.
- Retention/pseudonymization jobs preserve required aggregates and financial auditability while
  removing direct attribution on schedule.

#### T22. Grounded business-consultation chatbot

Dependencies: T1-T4 source-backed program records; T9-T10 deterministic gap/confidence semantics;
T13 recommendation retrieval where reusable; T21 usage ledger and quotas; conversation retention
policy. This is an MVP roadmap task but follows the active application tracker and its immediate
next-action journey.

Product UX and conversation flow:

- Position the assistant as a support-program discovery guide, not a lawyer, public official, or
  definitive eligibility adjudicator. Start from the signed-in user's current business profile,
  visibly state which profile facts are being used, and offer a direct profile-correction path.
- Ask one focused clarifying question at a time only when it can materially change retrieval or
  eligibility interpretation (for example location, business age, entity type, desired support,
  certification, or deadline). Do not force a long generic intake that duplicates onboarding.
- Present a small ranked set of candidate programs with direct internal detail links and original
  notice links, concise cited fit reasons, unmet/unknown requirements, evidence verification and
  freshness, deadline, and an explicit uncertainty statement. Support save-to-workspace and handoff
  into T5 next actions without duplicating tracker controls inside chat.
- When no grounded candidate exists, say so plainly, explain which constraints caused the result,
  suggest a profile update/search relaxation, or hand off to original agencies/human support. Never
  fabricate a program to keep the conversation going.

Retrieval, ranking, and grounding:

- Parse conversation intent into a controlled filter/query object; apply hard structured filters
  first, retrieve only active/current program records and latest approved eligibility requirements,
  then rank with deterministic match components plus bounded semantic relevance.
- The answer model receives only the minimum profile fields and retrieved program/source excerpts
  needed for the turn. Every factual program/eligibility claim must map to a stored requirement and
  exact evidence citation; uncited synthesis is labeled guidance or omitted.
- Separate `verified`, `inferred`, `unknown`, and profile-missing states. Use language such as
  “공고문상 조건과 일치해 보여요” rather than “신청 자격이 확실합니다”; direct users to the
  responsible agency/original notice for authoritative confirmation.
- Treat program titles, descriptions, attachments, source excerpts, prior chat, and user-entered
  text as untrusted data. System instructions explicitly prohibit following embedded instructions,
  revealing secrets, changing tools/authorization, or widening retrieval. Strip/segment content,
  constrain tool schemas, allowlist internal actions, and never execute links/code from sources.

Persistence and privacy:

- Store user-owned conversation/thread metadata and messages only with explicit product notice,
  RLS, timestamps, model/prompt-policy version, and deletion controls. Define retention before
  launch; allow ephemeral/no-history sessions if product policy permits.
- Minimize copied profile/source content in messages. Do not persist raw retrieved documents or
  hidden prompts in chat analytics. Uploaded/private document use is out of scope until T14-T15
  authorization and retention controls are complete.
- Server-only tools enforce the signed-in user's scope. Conversation IDs are unguessable; a user
  cannot load, continue, cite, or delete another user's conversation.

Limits, operations, and safety:

- Route every model/retrieval turn through T21 with feature `business_consultation`, user/workspace
  attribution, token/cache counts, outcome, reservation, and cost. Apply per-minute abuse limits,
  concurrent-turn limits, daily/monthly quotas, maximum history/retrieval/token budgets, timeouts,
  and a clear allowance state in the UI.
- Add safe fallbacks for model/provider failure, insufficient evidence, stale extraction, closed
  notices, quota exhaustion, and prompt-injection detection. Preserve a user's typed message for
  retry without claiming a failed answer was sent or saved.
- Provide safety copy near recommendations and any eligibility conclusion: eunwon summarizes
  public notices, requirements can change, and the agency/original notice is authoritative. Add a
  correction/report path that feeds T20 moderation rather than silently training on feedback.

Evaluation and acceptance criteria:

- A versioned Korean evaluation set covers common discovery questions, ambiguous profiles,
  no-result cases, conflicting requirements, closed/stale programs, adversarial notice text,
  malicious user injection, and follow-up clarification. Track retrieval recall/precision, citation
  correctness, unsupported-claim rate, candidate usefulness, latency, and cost per successful turn.
- On grounded test queries, every factual reason and requirement displayed has a valid direct
  citation to the retrieved current record/source; altered or nonexistent evidence causes the claim
  to be omitted or visibly uncertain, never upgraded to verified.
- Hard-ineligible candidates are excluded or clearly identified as conflicts before ranking;
  unknown profile fields are not treated as met, and the assistant asks only decision-relevant
  clarifications.
- Prompt-injection fixtures embedded in HTML/PDF/HWPX text, program fields, and user messages cannot
  change system behavior, access another user, reveal hidden prompts/secrets, or invoke unapproved
  actions/URLs.
- Every candidate includes a working internal program link and original notice link when available;
  save/handoff creates the expected saved record or T5 next action only after explicit user action.
- Cross-user conversation access and mutation fail in RLS and route tests. Conversation deletion,
  retention expiry, and analytics redaction work without corrupting T21 aggregate accounting.
- Quota reservations remain correct under concurrent/retried turns; every turn appears exactly once
  in the AI ledger with no raw prompt, completion, profile narrative, or source document content.
- Human/product review confirms Korean safety copy is prominent but not obstructive, fallback paths
  are actionable, and the bot never presents itself as an authoritative eligibility decision maker.

## Cross-cutting release gates

- Every migration is forward-only and preserves existing rows and UI consumers.
- User-owned tables have explicit RLS policies and service-only writes are documented.
- Import jobs are idempotent, bounded, observable, and safe to resume.
- AI output is schema-validated; failures degrade to existing data rather than erasing it.
- Accessibility and responsive UI review follow `DESIGN.md` before any UI phase ships.
- Each phase updates this roadmap, the decision log, and operational/backfill instructions.

## Decision log

| ID | Date | Decision | Status / rationale |
|---|---|---|---|
| D-001 | 2026-08-23 | Use normalized source, run, and requirement tables while retaining legacy flattened program fields. | Accepted; enables provenance without breaking matching/UI. |
| D-002 | 2026-08-23 | A requirement is `verified` only when its exact evidence quote exists in the stored source; otherwise downgrade to `inferred`. | Accepted; deterministic trust boundary. |
| D-003 | 2026-08-23 | Cache extraction by canonical source-set fingerprint plus extractor version. | Accepted; supports reuse and intentional backfills. |
| D-004 | 2026-08-23 | Support HTML/text first, PDF/HWPX next, and defer legacy HWP. | Accepted; no claim of HWP support without a tested path. |
| D-005 | 2026-08-23 | Keep imported source text service-write-only but publicly readable when tied to a public program. | Provisional; revisit if sources later include licensed/private material. |
| D-006 | 2026-08-23 | Preserve the last successful extraction if a later run fails. | Accepted; avoids data regression during sync. |
| D-007 | 2026-08-23 | Collaboration requires an organization/role product decision before implementation. | Open. |
| D-008 | 2026-08-23 | Vault retention, file limits, accepted MIME types, and malware scanning provider need product/security decisions. | Open. |
| D-009 | 2026-08-23 | Alert threshold/frequency and outcome-learning consent copy need product decisions. | Open. |
| D-010 | 2026-08-23 | Treat SEO/AEO as a quality-gated workstream after trustworthy source extraction; do not mass-index raw program/facet pages. | Accepted; prevents thin, duplicate, or unsupported pages. |
| D-011 | 2026-08-23 | Only visible, cited, source-backed answers may drive AEO content or structured data. | Accepted; aligns discoverability with product trust. |
| D-012 | 2026-08-23 | A secure, audited admin workspace is an MVP launch requirement, delivered access-first and read-only-first. | Accepted; operations need visibility without prematurely exposing mutation power. |
| D-013 | 2026-08-23 | Admin roles live outside user-editable profiles and all capabilities are enforced server-side plus RLS. | Accepted; UI hiding and service-role use are not human authorization. |
| D-014 | 2026-08-23 | Support impersonation is excluded from MVP; sensitive user/billing access is minimized, masked, and audited. | Accepted; reduces privacy and account-takeover risk. |
| D-015 | 2026-08-23 | AI usage accounting stores token/cost metadata, never raw prompts, outputs, source text, or documents. | Accepted; usage analytics do not become a shadow content store. |
| D-016 | 2026-08-23 | Import, backfill, and shared-cache AI costs use system/workspace attribution and never consume an arbitrary user's allowance. | Accepted; separates product COGS from user-triggered consumption. |
| D-017 | 2026-08-23 | The consultation chatbot retrieves first and may state only cited program facts; it is guidance, not an eligibility adjudicator. | Accepted; keeps answers useful and appropriately uncertain. |
| D-018 | 2026-08-23 | Program/source content is untrusted input and cannot issue instructions or expand tool access. | Accepted; prompt-injection resistance is part of the retrieval boundary. |
| D-019 | 2026-08-23 | Model application work as eight user-correctable stages with atomic history; terminal outcomes must explicitly restart at considering. | Accepted; supports real workflows and correction without silently rewriting history. |
| D-020 | 2026-08-23 | Separate daily opportunity briefings from saved-program deadline reminders, preserving opt-in defaults and independent controls. | Accepted; each service has a distinct user promise. |
| D-021 | 2026-08-23 | Calendar delivery begins with private, provider-free ICS export; Google Calendar sync requires explicit OAuth consent and durable idempotent state. | Accepted; useful first step without premature account access. |
| D-022 | 2026-08-23 | Program sharing contains public source-backed program facts only; private match/profile/application context is never placed in payloads or URLs. | Accepted; sharing must not become a data-leak path. |
| D-023 | 2026-08-23 | Bizinfo events remain a separate education/seminar/exhibition discovery product, not support-program matches. | Accepted; distinct relevance, saving, reminder, and calendar semantics. |
| D-024 | 2026-08-23 | Existing event code is partial until its assumptions are validated against a real API response and credentialed run. | Accepted; repository wiring alone is not proof of an active feed. |
| D-025 | 2026-08-23 | Preparation items derived from eligibility rules are actions to gather proof, not a claim that a specific document guarantees eligibility. | Accepted; verified/inferred labels and exact citations remain visible. |
| D-026 | 2026-08-23 | Snapshot checklist evidence at creation while retaining the source-requirement link; later extraction runs do not rewrite user completion. | Accepted; preserves an auditable application workspace. |
| D-027 | 2026-08-23 | Anonymous users cannot execute the tracker transition RPC, and eligibility extraction mutations are explicitly service-role-only at both grant and RLS layers. | Accepted and verified in production. |
| D-028 | 2026-08-24 | Signup must not expose whether an email address already has an account; remove the public auth lookup and use one completion response for new and existing addresses. | Accepted; migration 018 removed the SECURITY DEFINER RPC and the related advisor findings are cleared. |
| D-029 | 2026-08-24 | Do not enable Supabase leaked-password protection for the focused beta. | Owner decision accepted as a documented configuration risk; revisit before broad launch. |
| D-030 | 2026-08-24 | Limit the first eligibility pilot to 25 programs and a maximum KRW 10,000 spend, enforced operationally with a conservative 250,000-token ceiling and stop rules. | Accepted; observed usage was 24,964 tokens, and bulk work remains stopped after the semantic gate failed. |
| D-031 | 2026-08-25 | A verified requirement's user-facing text is the exact stored evidence quote; normalized model wording is allowed only for inferred content. | Accepted and validated by the v4 targeted gate; favors trustworthy display over aggressive normalization. |

## Resume checklist

1. Read this file and the latest migration.
2. Run `git status --short`; preserve unrelated changes.
3. Find the first task not marked complete and verify its dependencies.
4. Update the task/decision log as implementation changes assumptions.
5. Run `npm test`, `npm run lint`, and `npm run build` before handoff.
