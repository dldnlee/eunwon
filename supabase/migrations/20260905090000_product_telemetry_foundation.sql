create table public.product_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name in (
    'signup_completed', 'onboarding_completed', 'dashboard_viewed', 'matches_viewed',
    'program_opened', 'program_saved', 'application_started',
    'document_generated', 'document_exported'
  )),
  occurred_at timestamptz not null,
  properties jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  check (jsonb_typeof(properties) = 'object'),
  check (octet_length(properties::text) <= 2048)
);
create index product_events_user_occurred_idx on public.product_events (user_id, occurred_at desc);
create index product_events_name_occurred_idx on public.product_events (name, occurred_at desc);
alter table public.product_events enable row level security;
revoke all on table public.product_events from public, anon, authenticated;
