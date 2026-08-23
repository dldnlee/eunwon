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

#### T2. Import-time HTML/text extraction and reuse — partially complete

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
source-backed extraction is skipped), and add a mocked database importer test around retry/reuse.

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

#### T5. Application status tracker v2

Dependencies: none; extends existing `saved_programs.status`.

- Data: status history (`considering`, `preparing`, `submitted`, `screening`, `interview`,
  `selected`, `rejected`, `withdrawn`), submitted date, next action/date.
- API/UI: atomic transition endpoint; timeline and quick update in saved workspace.
- Tests/acceptance: valid transition history, user-only RLS, keyboard/mobile operation, existing
  saved statuses migrated without loss.

#### T6. What-to-prepare checklist

Dependencies: T1, T5.

- Data: program checklist templates sourced from notices plus per-user item state and due date.
- API/UI: copy template on first preparation, allow user additions, show source/verified badge.
- Tests/acceptance: template changes do not erase user completion; uncited AI items are labeled
  suggestions; checklist progress is accurate.

#### T7. Deadline urgency and calendar

Dependencies: T5.

- Data: optional personal target date and calendar-event identity.
- API/UI: timezone-safe D-day grouping, month/agenda views, `.ics` export; complement rather than
  duplicate existing 7/3/1 email reminders.
- Tests/acceptance: Asia/Seoul boundary and no-deadline cases; exported event opens correctly.

#### T8. Notes and collaboration

Dependencies: T5; organization/account model decision.

- Data: threaded notes, mentions, memberships, roles, audit log.
- API/UI: comments/activity panel and permissions.
- Tests/acceptance: tenant isolation, mention notification, edit/delete audit semantics.

### Phase 3 — Better decisions

#### T9. Business-profile gap analysis

Dependencies: T1.

- Data/API: evaluate normalized requirements against profile fields with `met`, `not_met`, or
  `unknown`; include missing profile fields and cited program rules.
- UI: actionable gaps, separating profile incompleteness from actual ineligibility.
- Tests/acceptance: deterministic rule matrix; no unknown treated as eligible or ineligible.

#### T10. Match confidence and explanation v2

Dependencies: T9.

- Data/API: persist score components, evidence coverage, freshness, and rule version.
- UI: score breakdown and uncertainty language; retain existing explanation feature.
- Tests/acceptance: reproducible score and calibration dataset; explanations never contradict
  hard eligibility rules.

#### T11. Program comparison

Dependencies: T6, T7, T10.

- Data/API: comparison projection for 2-4 program IDs.
- UI: aligned eligibility, benefit, deadline, documents, gaps, and confidence table.
- Tests/acceptance: URL-shareable selection, missing values shown as unknown, mobile fallback.

#### T12. Duplicate-benefit detection v2

Dependencies: T1, T5.

- Data/API: extract cited restriction clauses and compare benefit period/purpose/funding source
  against selected/submitted applications; replace the current category-only heuristic.
- UI: warning with source and “needs confirmation”, never a definitive legal conclusion.
- Tests/acceptance: known conflict/non-conflict fixtures and conservative ambiguous result.

#### T13. Similar-program recommendations

Dependencies: T10.

- Data/API: candidate retrieval from structured attributes, then rank by eligibility and semantic
  similarity; exclude closed/current program and explain differences.
- UI: similar programs on detail and closed-program replacement state.
- Tests/acceptance: all recommendations pass hard filters; ranking evaluation set is versioned.

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

## Resume checklist

1. Read this file and the latest migration.
2. Run `git status --short`; preserve unrelated changes.
3. Find the first task not marked complete and verify its dependencies.
4. Update the task/decision log as implementation changes assumptions.
5. Run `npm test`, `npm run lint`, and `npm run build` before handoff.
