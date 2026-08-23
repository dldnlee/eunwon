-- Production-ready Events foundation: normalized source fields, sync health, saved events,
-- independent reminders, and calendar-safe user ownership.

alter table events
  add column registration_url text,
  add column location_name text,
  add column is_online boolean not null default false,
  add column source_updated_at date,
  add column content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');

create table event_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'bizinfo',
  status text not null check (status in ('running', 'succeeded', 'failed')),
  pages_fetched int not null default 0,
  items_seen int not null default 0,
  items_synced int not null default 0,
  items_skipped int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table event_sync_runs enable row level security;
-- Operational table: service-role only until the T20 admin workspace ships.

create table saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  notes text check (notes is null or char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

alter table saved_events enable row level security;
create policy "users can read own saved events" on saved_events for select using (auth.uid() = user_id);
create policy "users can insert own saved events" on saved_events for insert with check (auth.uid() = user_id);
create policy "users can update own saved events" on saved_events for update using (auth.uid() = user_id);
create policy "users can delete own saved events" on saved_events for delete using (auth.uid() = user_id);

alter table profiles
  add column notify_event_reminders boolean not null default false,
  add column event_reminder_days int[] not null default '{7,1}',
  add constraint profiles_event_reminder_days_check check (
    cardinality(event_reminder_days) between 1 and 5
    and event_reminder_days <@ array[
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
      21,22,23,24,25,26,27,28,29,30
    ]
  );

create table event_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('registration_deadline', 'event_start')),
  lead_days int not null check (lead_days between 1 and 30),
  sent_at timestamptz not null default now(),
  unique (user_id, event_id, reminder_kind, lead_days)
);

alter table event_notification_log enable row level security;
create policy "users can read own event notification log"
  on event_notification_log for select using (auth.uid() = user_id);
