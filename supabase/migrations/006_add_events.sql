-- Business-support events (전시회/박람회/세미나/교육/설명회 등) — separate from
-- `programs` (funding/support announcements). Synced from bizinfo's own Event
-- API (bizinfoEventApi), a sibling of the pblancBsnsService feed `programs`
-- already uses — see lib/sync/syncEvents.ts.

create table events (
  id              uuid primary key default gen_random_uuid(),
  external_id     text unique not null,        -- bizinfo event id
  source          text not null default 'bizinfo',

  title           text not null,
  event_type      text,                        -- 세미나 | 전시회 | 설명회 | 교육 등
  category        text,                        -- bizinfo large-category label
  host_org        text,                        -- originOrg

  description     text,

  region          text[] not null default '{}',
  is_nationwide   boolean not null default false,

  event_start     date,
  event_end       date,
  apply_start     date,
  apply_end       date,

  detail_url      text,

  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index events_event_end_active_idx on events (event_end, is_active);
create index events_region_idx on events using gin (region);

alter table events enable row level security;

-- events are public read; writes only via service role (sync job)
create policy "events are publicly readable"
  on events for select
  using (true);
