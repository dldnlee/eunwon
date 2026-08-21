-- Content hash of the raw bizinfo source item for a program, used by the
-- nightly sync (lib/sync/syncPrograms.ts) to detect whether a program's
-- source data changed since the last run. Unchanged programs skip the
-- per-item AI re-enrichment call entirely, since it previously ran
-- unconditionally on every program every night regardless of whether
-- anything about it had changed.
alter table programs add column source_hash text;
