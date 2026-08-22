-- Persists the AI 매칭도 rating (lib/ai/rateProgramMatch.ts) per (user, program) pair.
-- Previously this was computed fresh on every dashboard load and held only in React state —
-- lost on refresh, never shared across sessions/devices, and re-billed to Upstage every visit.
--
-- Keyed by user_id (not just program_id) because the rating depends on that user's profile,
-- not the program alone — two different companies get two different AI opinions on the same
-- program. See app/api/ai/rate-program-match/route.ts for the cache-check/upsert logic.

create table ai_program_ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  program_id  uuid not null references programs(id) on delete cascade,
  match_rate  int not null check (match_rate >= 0 and match_rate <= 100),
  reason      text,
  rated_at    timestamptz not null default now(),
  unique (user_id, program_id)
);

alter table ai_program_ratings enable row level security;

create policy "users can read own ai ratings"
  on ai_program_ratings for select
  using (auth.uid() = user_id);

create policy "users can insert own ai ratings"
  on ai_program_ratings for insert
  with check (auth.uid() = user_id);

create policy "users can update own ai ratings"
  on ai_program_ratings for update
  using (auth.uid() = user_id);
