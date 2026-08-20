-- Eunwon AI expansion — see docs/eunwon-master.md
--
-- Rebuilds `profiles` around real eligibility fields (industry, age, certifications),
-- reworks `saved_programs` into an application-outcome tracker (for 중복수혜 detection),
-- renames `notifications` -> `notification_log` with a `type` column (new_match /
-- deadline_7d / deadline_3d / deadline_1d), and adds `user_documents` for the future
-- document vault (Phase 5 — table only, no Storage bucket/UI yet).
--
-- NOTE on age_months: the master plan specifies it as a Postgres GENERATED column
-- using `age(current_date, founded_at)`. Postgres requires generated-column
-- expressions to be IMMUTABLE, and `current_date` is only STABLE — that statement
-- would fail with "generation expression is not immutable". Instead, age_months is
-- a plain column that the app computes (lib/utils.ts:getAgeMonths) and writes
-- alongside founded_at on every insert/update.

-- ─── profiles ──────────────────────────────────────────────────────────────

alter table profiles rename column business_name to company_name;
alter table profiles rename column business_type to industry_name;
alter table profiles rename column annual_revenue to annual_revenue_krw;

alter table profiles
  add column representative_name text,
  add column business_number    text,          -- 사업자등록번호
  add column industry_code      text,          -- KSIC 5-digit
  add column tech_domains       text[] not null default '{}',
  add column age_months         integer,       -- app-computed, see note above
  add column certifications     text[] not null default '{}',
  add column current_challenges text,
  add column onboarding_complete boolean not null default false;

-- existing rows only exist because someone already completed the old onboarding flow
update profiles set onboarding_complete = true;
update profiles set age_months = (
  extract(year from age(current_date, founded_at)) * 12 +
  extract(month from age(current_date, founded_at))
)::integer
where founded_at is not null;

alter table profiles drop column is_tech_company;

-- ─── programs ──────────────────────────────────────────────────────────────
-- Columns below were never populated by the bizinfo sync (no reliable source data)
-- and aren't part of the master plan's matching logic — dropping them to match.

alter table programs
  drop column business_types,
  drop column min_employees,
  drop column max_employees,
  drop column min_revenue,
  drop column max_revenue,
  drop column min_age_months,
  drop column amount_text,
  drop column amount_max;

-- ─── saved_programs → application-outcome tracker ───────────────────────────

alter table saved_programs
  add column outcome     text,        -- free-text outcome note (선정/탈락 detail)
  add column received_at date,
  add column amount_krw  integer;

-- constraint must be dropped before the UPDATE below — it still only permits the
-- old Korean values at this point, and would reject the new English ones mid-write
alter table saved_programs drop constraint saved_programs_status_check;

update saved_programs set status = case status
  when '관심'   then 'saved'
  when '신청중' then 'applied'
  when '완료'   then 'selected'
  else status
end;

alter table saved_programs alter column status set default 'saved';
alter table saved_programs
  add constraint saved_programs_status_check
  check (status in ('saved', 'applied', 'selected', 'rejected'));

-- ─── notifications → notification_log (adds `type`, 0 rows, safe to recreate) ──

drop table notifications;

create table notification_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  program_id  uuid not null references programs(id) on delete cascade,
  type        text not null check (type in ('new_match', 'deadline_7d', 'deadline_3d', 'deadline_1d')),
  sent_at     timestamptz not null default now(),
  unique (user_id, program_id, type)
);

alter table notification_log enable row level security;

create policy "users can read own notification log"
  on notification_log for select
  using (auth.uid() = user_id);

-- ─── user_documents (document vault — table only; Storage bucket/UI is Phase 5) ─

create table user_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('bizreg', 'financial', 'resume', 'past_application')),
  filename      text not null,
  storage_path  text not null,
  year          integer,
  created_at    timestamptz not null default now()
);

alter table user_documents enable row level security;

create policy "users can read own documents"
  on user_documents for select
  using (auth.uid() = user_id);

create policy "users can insert own documents"
  on user_documents for insert
  with check (auth.uid() = user_id);

create policy "users can delete own documents"
  on user_documents for delete
  using (auth.uid() = user_id);
