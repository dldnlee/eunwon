-- Instagram marketing workflow foundation (docs/automated-instagram-marketing-plan.md §5).
-- Phases 1–3 scope: draft generation + approval dashboard. Publishing/analytics tables are
-- created now so later phases don't need a second structural migration, but nothing writes
-- to them yet.
--
-- Access model: default-deny RLS; content managers reach marketing_posts only through
-- policies backed by has_admin_capability('marketing_content_manage'), which is mapped to
-- the existing content_reviewer and admin_owner roles below.

-- ── capability mapping ───────────────────────────────────────────────────────────────

create or replace function public.has_admin_capability(requested_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_role_assignments assignment
    where assignment.user_id = (select auth.uid())
      and case assignment.role
        when 'support_readonly' then requested_capability = any (array['admin_access', 'user_read', 'notification_read', 'audit_write'])
        when 'content_reviewer' then requested_capability = any (array['admin_access', 'user_read', 'notification_read', 'import_read', 'eligibility_review', 'marketing_content_manage', 'audit_write'])
        when 'billing_operator' then requested_capability = any (array['admin_access', 'user_read', 'billing_read', 'billing_manage', 'audit_write'])
        when 'admin_owner' then requested_capability = any (array['admin_access', 'user_read', 'notification_read', 'import_read', 'eligibility_review', 'billing_read', 'billing_manage', 'role_manage', 'marketing_content_manage', 'audit_read', 'audit_write'])
        else false
      end
  );
$$;

-- ── AI usage ledger: allow the new marketing feature ─────────────────────────────────

alter table public.ai_usage_events drop constraint ai_usage_events_feature_check;
alter table public.ai_usage_events add constraint ai_usage_events_feature_check
  check (feature in ('match_explanation', 'match_rating', 'document_draft', 'eligibility_extraction', 'program_enrichment', 'consultation_chat', 'marketing_content_generation'));

-- ── tables ───────────────────────────────────────────────────────────────────────────

create table public.marketing_posts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete set null,
  content_type text not null check (content_type in ('program_spotlight', 'deadline_roundup', 'eligibility_explainer', 'common_mistake', 'product_walkthrough', 'customer_result')),
  status text not null default 'candidate' check (status in (
    'candidate', 'generating', 'validation_failed', 'awaiting_approval',
    'rejected', 'approved', 'scheduled', 'publishing',
    'published', 'publish_failed', 'cancelled'
  )),
  candidate_score numeric check (candidate_score is null or candidate_score >= 0),
  fact_snapshot jsonb not null check (jsonb_typeof(fact_snapshot) = 'object'),
  generated_content jsonb check (generated_content is null or jsonb_typeof(generated_content) = 'object'),
  validation_errors jsonb check (validation_errors is null or jsonb_typeof(validation_errors) = 'array'),
  caption text,
  source_url text,
  scheduled_for timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_reason text check (rejected_reason is null or char_length(rejected_reason) between 3 and 500),
  platform text not null default 'instagram',
  platform_media_id text,
  platform_permalink text,
  idempotency_key text unique,
  generation_version text not null default 'v1',
  template_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_posts_status_idx on public.marketing_posts (status, scheduled_for);
create index marketing_posts_program_idx on public.marketing_posts (program_id)
  where program_id is not null;

create table public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  marketing_post_id uuid not null references public.marketing_posts(id) on delete cascade,
  slide_index int not null check (slide_index >= 0),
  storage_path text not null,
  width int not null check (width > 0),
  height int not null check (height > 0),
  checksum text not null,
  alt_text text,
  created_at timestamptz not null default now(),
  unique (marketing_post_id, slide_index)
);

create table public.marketing_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  marketing_post_id uuid not null references public.marketing_posts(id) on delete cascade,
  attempt_number int not null check (attempt_number >= 1),
  started_at timestamptz not null,
  finished_at timestamptz,
  result text check (result in ('success', 'transient_error', 'auth_error', 'invalid_content', 'program_invalid', 'unknown_error')),
  platform_error_code text,
  error_summary text check (error_summary is null or char_length(error_summary) <= 1000),
  retry_after timestamptz,
  unique (marketing_post_id, attempt_number)
);

create table public.marketing_insights (
  id uuid primary key default gen_random_uuid(),
  marketing_post_id uuid not null references public.marketing_posts(id) on delete cascade,
  measurement_window text not null check (measurement_window in ('24h', '72h', '7d', '30d')),
  measured_at timestamptz not null default now(),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  unique (marketing_post_id, measurement_window)
);

-- ── updated_at trigger ───────────────────────────────────────────────────────────────

create or replace function public.touch_marketing_post_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger marketing_posts_touch_updated_at
before update on public.marketing_posts
for each row execute function public.touch_marketing_post_updated_at();

-- ── RLS: default deny; capability-backed policies for marketing_posts only ───────────
-- Assets/attempts/insights stay fully service-role-only until their phases ship.

alter table public.marketing_posts enable row level security;
alter table public.marketing_assets enable row level security;
alter table public.marketing_publish_attempts enable row level security;
alter table public.marketing_insights enable row level security;

revoke all on table public.marketing_posts from public, anon;
revoke all on table public.marketing_assets from public, anon, authenticated;
revoke all on table public.marketing_publish_attempts from public, anon, authenticated;
revoke all on table public.marketing_insights from public, anon, authenticated;

create policy "content managers read marketing posts"
  on public.marketing_posts for select
  to authenticated
  using (public.has_admin_capability('marketing_content_manage'));

create policy "content managers create marketing posts"
  on public.marketing_posts for insert
  to authenticated
  with check (public.has_admin_capability('marketing_content_manage'));

create policy "content managers update marketing posts"
  on public.marketing_posts for update
  to authenticated
  using (public.has_admin_capability('marketing_content_manage'))
  with check (public.has_admin_capability('marketing_content_manage'));

-- No delete policy: workflow rows move to 'cancelled' instead of disappearing.
