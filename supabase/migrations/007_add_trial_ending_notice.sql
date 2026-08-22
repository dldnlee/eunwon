-- One-shot flag so the trial-ending warning email (see
-- app/api/cron/notify-users/route.ts) only ever fires once per account,
-- regardless of how many times the daily cron re-checks it.
--
-- Deliberately NOT modeled through notification_log: that table's
-- (user_id, program_id, type) shape and NOT NULL program_id are
-- program-centric (new-match/deadline alerts), and a trial-ending notice
-- isn't about any particular program.

alter table profiles
  add column if not exists trial_ending_notified_at timestamptz;
