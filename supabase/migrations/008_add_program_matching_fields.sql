-- Richer per-program eligibility/feature fields for more accurate matching —
-- mirrors the profile-side fields already collected at onboarding
-- (employee_count, annual_revenue_krw, age_months, business_traits,
-- tech_domains, certifications, extra_tags, rnd_capability, investment_stage)
-- so matching.ts can compare like-for-like instead of guessing from
-- freeform ai_tags text. Populated by the AI enrichment step in
-- lib/sync/syncPrograms.ts — see that file for the extraction prompt.

alter table programs
  -- numeric eligibility bounds — bizinfo listings frequently state these
  -- (e.g. "상시근로자 50인 미만", "연매출 10억원 이하", "설립 1년 이상")
  add column min_employees             int,
  add column max_employees             int,
  add column min_annual_revenue_krw    bigint,
  add column max_annual_revenue_krw    bigint,
  add column min_age_months            int,   -- complements the existing max_age_months

  -- funding facts — extracted but not currently modeled at all
  add column funding_amount_krw        bigint,  -- 최대 지원금액, when stated
  add column funding_type              text,    -- 보조금 | 융자 | 보증 | 바우처 | 세제지원 | 기타

  -- structured requirement mirrors of the profile's own optional-criteria
  -- fields — replaces scoreMatch()'s previous reliance on freeform ai_tags
  -- happening to contain the right words
  add column required_business_traits  text[] not null default '{}',  -- B2B, B2C, B2G, 수출기업, 수출준비중, 채용 확대 예정
  add column required_tech_domains     text[] not null default '{}',  -- AI/소프트웨어, 바이오/헬스케어 등
  add column required_certifications   text[] not null default '{}',  -- 벤처기업, 이노비즈, 메인비즈
  add column required_extra_tags       text[] not null default '{}',  -- 여성기업, 장애인기업, 사회적기업, 재창업, 청년창업
  add column required_rnd_capability   text[] not null default '{}',  -- 기업부설연구소 보유, 전담부서 보유, 특허/지식재산권 보유
  add column required_investment_stage text;    -- 없음 | 시드투자 유치 | 시리즈A 이상 투자유치, null = no requirement
