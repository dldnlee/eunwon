-- 정부지원사업 매칭 서비스 — initial schema
-- Column set on `programs` reflects the fields the bizinfo sync script
-- (scripts/sync-programs.ts) actually populates, plus the profile-matching
-- columns from the build plan (min/max employees, revenue, business_types)
-- which are nullable until a source provides them.

create extension if not exists pgcrypto;

-- ─── programs ──────────────────────────────────────────────────────────────

create table programs (
  id              uuid primary key default gen_random_uuid(),
  external_id     text unique not null,       -- ID from source API (pblancId)
  source          text not null,              -- 'bizinfo' | 'kstartup' | 'manual'

  title           text not null,              -- pblancNm
  agency          text not null,              -- 주관기관 (jrsdInsttNm)
  exec_agency     text,                       -- 수행기관 (excInsttNm)
  category        text,                       -- 융자 | 보조금 | 보증 | 교육 | 컨설팅 등
  target_raw      text,                       -- raw 지원대상 text (trgetNm)

  description     text,                       -- stripped bsnsSumryCn
  apply_method    text,                       -- reqstMthPapersCn
  apply_url       text,
  detail_url      text,

  deadline_start  date,
  deadline_end    date,

  region          text[] not null default '{}',   -- ['전국'] or ['서울','경기']
  entity_types    text[] not null default '{}',   -- ['법인','개인사업자','예비창업자',...]
  is_nationwide   boolean not null default false,

  hashtags_raw    text,

  -- profile-matching fields — not provided by bizinfo, populated manually
  -- or by a future enrichment source; matching.ts treats null as "no limit"
  business_types  text[],
  min_employees   int,
  max_employees   int,
  min_revenue     bigint,
  max_revenue     bigint,
  min_age_months  int,
  max_age_months  int,
  amount_text     text,
  amount_max      bigint,

  -- AI-enriched fields
  ai_summary      text,
  ai_tags         text[] not null default '{}',

  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index programs_deadline_active_idx on programs (deadline_end, is_active);
create index programs_region_idx on programs using gin (region);
create index programs_entity_types_idx on programs using gin (entity_types);
create index programs_business_types_idx on programs using gin (business_types);

-- ─── profiles ──────────────────────────────────────────────────────────────

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  business_name   text,
  business_type   text not null,              -- 업종 code (한국표준산업분류)
  region          text not null,              -- 시/도
  entity_type     text not null,              -- 법인 | 개인사업자 | 예비창업자
  employee_count  int,
  annual_revenue  bigint,                     -- 원
  founded_at      date,                       -- to calculate 업력
  is_tech_company boolean not null default false,
  extra_tags      text[] not null default '{}',  -- 여성기업, 장애인기업 등
  subscription    text not null default 'free' check (subscription in ('free', 'pro')),
  notify_email    boolean not null default true,     -- daily new-match email alerts
  toss_billing_key   text,                            -- 토스페이먼츠 정기결제 빌링키
  toss_customer_key  text,                            -- 토스페이먼츠 customerKey (opaque, generated at signup)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── saved_programs ────────────────────────────────────────────────────────

create table saved_programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  program_id  uuid not null references programs(id) on delete cascade,
  status      text not null default '관심' check (status in ('관심', '신청중', '완료')),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (user_id, program_id)
);

-- ─── notifications ─────────────────────────────────────────────────────────

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  program_id  uuid not null references programs(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  unique (user_id, program_id)
);

-- ─── row-level security ────────────────────────────────────────────────────

alter table programs enable row level security;
alter table profiles enable row level security;
alter table saved_programs enable row level security;
alter table notifications enable row level security;

-- programs are public read; writes only via service role (sync script)
create policy "programs are publicly readable"
  on programs for select
  using (true);

-- profiles: a user can only read/write their own row
create policy "users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- saved_programs: a user can only read/write their own rows
create policy "users can read own saved programs"
  on saved_programs for select
  using (auth.uid() = user_id);

create policy "users can insert own saved programs"
  on saved_programs for insert
  with check (auth.uid() = user_id);

create policy "users can update own saved programs"
  on saved_programs for update
  using (auth.uid() = user_id);

create policy "users can delete own saved programs"
  on saved_programs for delete
  using (auth.uid() = user_id);

-- notifications: a user can only read their own rows (writes are service-role only)
create policy "users can read own notifications"
  on notifications for select
  using (auth.uid() = user_id);
