-- Source-backed eligibility extraction. These normalized tables coexist with the flattened
-- `programs.required_*` fields until matching consumers migrate.

create table program_source_documents (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references programs(id) on delete cascade,
  source_key      text not null,
  source_type     text not null check (source_type in ('api_text', 'html', 'pdf', 'hwpx', 'hwp')),
  source_url      text,
  title           text,
  content_text    text not null,
  content_sha256  text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  extraction_status text not null default 'extracted'
    check (extraction_status in ('extracted', 'unsupported', 'failed')),
  fetched_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (program_id, source_key)
);

create index program_source_documents_program_idx on program_source_documents (program_id);
create index program_source_documents_hash_idx on program_source_documents (content_sha256);

create table program_extraction_runs (
  id                  uuid primary key default gen_random_uuid(),
  program_id          uuid not null references programs(id) on delete cascade,
  source_fingerprint  text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  extractor_version   text not null,
  model               text not null,
  status              text not null check (status in ('running', 'succeeded', 'failed')),
  error_message       text,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  unique (program_id, source_fingerprint, extractor_version)
);

create index program_extraction_runs_lookup_idx
  on program_extraction_runs (program_id, source_fingerprint, extractor_version, status);

create table program_eligibility_requirements (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references programs(id) on delete cascade,
  extraction_run_id uuid not null references program_extraction_runs(id) on delete cascade,
  source_document_id uuid references program_source_documents(id) on delete restrict,
  requirement_type  text not null check (requirement_type in (
    'entity_type', 'region', 'business_age', 'employee_count', 'annual_revenue',
    'industry', 'business_trait', 'technology_domain', 'certification', 'extra_tag',
    'rnd_capability', 'investment_stage', 'exclusion', 'other'
  )),
  operator          text not null check (operator in ('eq', 'in', 'gte', 'lte', 'between', 'contains', 'excludes')),
  value_json        jsonb not null,
  normalized_text   text not null,
  evidence_quote    text,
  evidence_start    int,
  evidence_end      int,
  verification      text not null check (verification in ('verified', 'inferred')),
  confidence        numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  created_at        timestamptz not null default now(),
  check (verification <> 'verified' or (source_document_id is not null and evidence_quote is not null))
);

create index program_eligibility_requirements_program_idx
  on program_eligibility_requirements (program_id, requirement_type);
create index program_eligibility_requirements_run_idx
  on program_eligibility_requirements (extraction_run_id);

alter table program_source_documents enable row level security;
alter table program_extraction_runs enable row level security;
alter table program_eligibility_requirements enable row level security;

create policy "program sources are publicly readable"
  on program_source_documents for select using (true);
create policy "program extraction runs are publicly readable"
  on program_extraction_runs for select using (true);
create policy "program eligibility requirements are publicly readable"
  on program_eligibility_requirements for select using (true);

-- Inserts/updates/deletes intentionally have no public policy and are service-role only.
