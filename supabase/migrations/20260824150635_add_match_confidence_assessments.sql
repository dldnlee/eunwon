-- Reproducible, user-owned match-confidence snapshots. Scores describe evidence quality and
-- profile coverage; they are never an eligibility probability or an authorization input.
create table public.program_match_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  extraction_run_id uuid references public.program_extraction_runs(id) on delete set null,
  rule_version text not null,
  input_fingerprint text not null check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  result_state text not null check (result_state in ('aligned', 'mismatch', 'unknown')),
  confidence_score smallint not null check (confidence_score between 0 and 100),
  evidence_coverage numeric(5,4) not null check (evidence_coverage between 0 and 1),
  profile_coverage numeric(5,4) not null check (profile_coverage between 0 and 1),
  uncertainty_ratio numeric(5,4) not null check (uncertainty_ratio between 0 and 1),
  freshness_days integer check (freshness_days is null or freshness_days >= 0),
  profile_updated_at timestamptz not null,
  program_updated_at timestamptz not null,
  extraction_completed_at timestamptz,
  components jsonb not null check (jsonb_typeof(components) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, program_id, rule_version, input_fingerprint)
);

create index program_match_assessments_user_created_idx
  on public.program_match_assessments (user_id, created_at desc);
create index program_match_assessments_program_idx
  on public.program_match_assessments (program_id);
create index program_match_assessments_extraction_run_idx
  on public.program_match_assessments (extraction_run_id)
  where extraction_run_id is not null;

alter table public.program_match_assessments enable row level security;

create policy "users can read own match assessments"
  on public.program_match_assessments for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert own match assessments"
  on public.program_match_assessments for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can delete own match assessments"
  on public.program_match_assessments for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.program_match_assessments to authenticated;
revoke all on public.program_match_assessments from anon;
