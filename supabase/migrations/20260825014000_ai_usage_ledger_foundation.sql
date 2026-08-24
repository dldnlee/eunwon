-- T21 foundation: privacy-reduced, append-only AI usage accounting.
-- Raw prompts, completions, documents, provider payloads, and raw errors have no columns here.

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  attribution_class text not null check (attribution_class in ('user', 'workspace', 'system_import', 'admin_operation')),
  feature text not null check (feature in ('match_explanation', 'match_rating', 'document_draft', 'eligibility_extraction', 'program_enrichment', 'consultation_chat')),
  action text not null check (char_length(action) between 2 and 100),
  provider text not null check (char_length(provider) between 2 and 50),
  model text not null check (char_length(model) between 2 and 100),
  provider_request_id_hash text check (provider_request_id_hash is null or char_length(provider_request_id_hash) = 64),
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  cache_read_tokens bigint check (cache_read_tokens is null or cache_read_tokens >= 0),
  cache_write_tokens bigint check (cache_write_tokens is null or cache_write_tokens >= 0),
  estimated_cost_microusd bigint check (estimated_cost_microusd is null or estimated_cost_microusd >= 0),
  pricing_version text check (pricing_version is null or char_length(pricing_version) <= 100),
  outcome text not null check (outcome in ('succeeded', 'provider_error', 'timeout', 'cancelled', 'rejected_limit')),
  error_category text check (error_category is null or error_category in ('auth', 'rate_limit', 'provider', 'timeout', 'invalid_response', 'internal', 'limit')),
  correlation_hash text not null check (char_length(correlation_hash) = 64),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (completed_at >= started_at),
  check ((attribution_class = 'user' and user_id is not null) or attribution_class <> 'user')
);

create unique index ai_usage_events_correlation_idx on public.ai_usage_events (correlation_hash);
create index ai_usage_events_user_created_idx on public.ai_usage_events (user_id, created_at desc) where user_id is not null;
create index ai_usage_events_attribution_created_idx on public.ai_usage_events (attribution_class, created_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on table public.ai_usage_events from public, anon, authenticated;

create or replace function public.prevent_ai_usage_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$ begin raise exception 'AI usage events are append-only' using errcode = '42501'; end; $$;
create trigger ai_usage_events_append_only before update or delete on public.ai_usage_events
for each row execute function public.prevent_ai_usage_mutation();
revoke execute on function public.prevent_ai_usage_mutation() from public, anon, authenticated;

create or replace function public.get_my_ai_usage_summary(period_start timestamptz, period_end timestamptz)
returns table (feature text, request_count bigint, input_tokens bigint, output_tokens bigint, usage_missing_count bigint)
language sql stable security definer set search_path = public, pg_temp
as $$
  select event.feature,
    count(*)::bigint,
    sum(event.input_tokens)::bigint,
    sum(event.output_tokens)::bigint,
    count(*) filter (where event.input_tokens is null or event.output_tokens is null)::bigint
  from public.ai_usage_events event
  where event.user_id = (select auth.uid())
    and event.attribution_class = 'user'
    and event.created_at >= period_start and event.created_at < period_end
  group by event.feature
  order by event.feature;
$$;
revoke execute on function public.get_my_ai_usage_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_my_ai_usage_summary(timestamptz, timestamptz) to authenticated, service_role;
