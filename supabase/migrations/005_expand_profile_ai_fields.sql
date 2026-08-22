-- Richer company profile for AI matching — see docs/eunwon-master.md philosophy
-- ("every field in profiles maps directly to a filtering/reasoning criterion").
--
-- Also patches a drift bug: commit 7f762ce added interest_categories,
-- business_verified, business_status, business_verified_at to lib/types.ts and
-- both onboarding/settings forms, but no migration ever created those columns —
-- `if not exists` makes this safe to run whether or not they already exist.

alter table profiles
  add column if not exists interest_categories  text[] not null default '{}',
  add column if not exists business_verified    boolean not null default false,
  add column if not exists business_status      text check (business_status in ('active', 'suspended', 'closed')),
  add column if not exists business_verified_at timestamptz;

-- ─── new AI-matching signals ───────────────────────────────────────────────

alter table profiles
  add column business_description text,           -- free text: what the business does, product/customer/differentiator
  add column business_traits      text[] not null default '{}',  -- B2B, B2C, B2G, 수출기업, 수출준비중, 채용 확대 예정
  add column rnd_capability       text[] not null default '{}',  -- 기업부설연구소 보유, 전담부서 보유, 특허/지식재산권 보유
  add column investment_stage     text;             -- 없음 | 시드투자 유치 | 시리즈A 이상 투자유치

-- ─── free NTS registry signal, previously fetched but discarded ───────────
-- (checkBusinessStatus() already calls the NTS status API for business_status;
-- tax_type and end_dt are in that same response and now get persisted too.)

alter table profiles
  add column business_tax_type  text,   -- 과세유형, e.g. '부가가치세 일반과세자' — raw NTS text
  add column business_closed_at date;    -- 폐업일자, only set when business_status = 'closed'
