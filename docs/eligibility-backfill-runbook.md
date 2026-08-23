# Eligibility evidence backfill runbook

Last updated: 2026-08-23

This runbook governs production population of source-backed eligibility evidence. It is intentionally
conservative: the current three-program observation validates a narrow path, not corpus-wide quality.
Do not turn the sample command into a bulk runner by increasing its hard cap or repeatedly invoking it.

## Preconditions

- Confirm the intended extractor version, prompt contract, and database migrations are deployed.
- Confirm the private environment contains the required provider and Supabase credentials without
  printing them. Never copy credentials into shell history, logs, fixtures, or review artifacts.
- Record candidate count by source type and category before writing. Exclude programs whose source
  text is empty or whose notice is no longer active.
- Run the deterministic extraction and persistence suites. A failure blocks the batch.
- Establish a written cost ceiling and an operator/reviewer for the batch. Broad backfill requires
  explicit release-owner approval; import-time extraction for newly synced records may continue.

## Staged batch policy

1. **Gate sample:** use the existing 1–5 program command once for a new extractor version. Review
   every result and every failure.
2. **Pilot batch:** at most 25 programs, concurrency 1. Review 100% of requirements before continuing.
3. **Controlled batches:** at most 100 programs per batch, concurrency no greater than 2. Review a
   stratified 10% sample with a minimum of 10 programs, plus every inferred, low-confidence
   (`< 0.80`), empty, or failed result.
4. **Steady import:** only after two consecutive controlled batches pass. Fingerprint/version cache
   reuse remains mandatory; unchanged successful records must not call the model again.

Stratify review across program category, region/nationwide scope, source length, and requirement type.
HTML/PDF/HWPX acquisition is evaluated separately when implemented. Legacy HWP is unsupported until
a working tested path exists.

## Review checklist

- Each `verified` requirement has a source document, exact quote, and offsets that reproduce that
  quote byte-for-text from the stored normalized source.
- The complete normalized claim is supported by the quote; surrounding context does not negate or
  narrow it. Normalization that adds unstated geography, entity type, age, amount, or date is inferred.
- `inferred` requirements use uncertainty language and are never presented as an eligibility verdict.
- Confidence measures extraction certainty, not applicant eligibility or award probability.
- Duplicate, contradictory, and implausibly broad requirements are flagged for correction rather
  than silently accepted.
- Failed/empty results retain the previous successful run and expose a bounded diagnostic message.

Record only program IDs, aggregate counts, reviewer disposition, and non-sensitive defect notes in
the review artifact. Do not export source documents or user/profile data.

## Automatic stop rules

Stop the batch immediately and do not start another when any of these occurs:

- one verified citation is missing, offset-invalid, or not an exact source substring;
- one verified normalized claim materially exceeds or contradicts its cited text;
- two consecutive provider/persistence failures, or batch failure rate exceeds 10%;
- any unexpected zero-requirement success for a non-empty target source;
- database/RLS/schema errors, source truncation, provider rate-limit exhaustion, or credential errors;
- the written cost ceiling or maximum batch size is reached;
- more than 20% of reviewed facts require verified-to-inferred correction.

Provider timeouts and rate limits may be retried once with bounded backoff. Validation, schema, citation,
and authorization failures are not automatically retried.

## Failure handling, rollback, and resume

- Runs are versioned and append-safe. Never delete the last successful run as a rollback mechanism.
- A retry reuses the unique program/fingerprint/version run row and replaces requirements for that run
  only. It must not delete requirements belonging to an earlier successful version or fingerprint.
- Mark the current run failed with a redacted diagnostic. Do not store prompts, credentials, or full
  provider responses in `error_message`.
- Fix deterministic causes, bump the extractor version when the extraction contract changes, repeat
  the 1–5 gate sample, and resume only unprocessed/failed candidates. Successful matching
  fingerprint/version rows remain cached.
- If a released version is unsafe, stop consumers from selecting it and restore selection of the last
  reviewed successful version. Any destructive cleanup requires a separate reviewed migration.

## Batch completion evidence

A batch passes only when counts reconcile (candidate = succeeded + failed + deliberately skipped),
all stop rules remain clear, the required review sample passes, cache-hit behavior is observed, and the
operator records version, timestamps, size, duration, aggregate outcomes, and reviewer sign-off. These
records are operational evidence, not a claim that every applicant is eligible.
