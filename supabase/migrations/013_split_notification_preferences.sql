-- Separate the daily opportunity briefing from saved-program deadline reminders while preserving
-- the legacy notify_email value as both services' initial preference.

alter table profiles
  add column notify_opportunity_digest boolean not null default true,
  add column notify_deadline_reminders boolean not null default true,
  add column deadline_reminder_days int[] not null default '{7,3,1}',
  add constraint profiles_deadline_reminder_days_check check (
    cardinality(deadline_reminder_days) between 1 and 5
    and deadline_reminder_days <@ array[
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
      21,22,23,24,25,26,27,28,29,30
    ]
  );

update profiles set
  notify_opportunity_digest = notify_email,
  notify_deadline_reminders = notify_email;

alter table notification_log add column lead_days int;

alter table notification_log drop constraint notification_log_type_check;
alter table notification_log drop constraint notification_log_user_id_program_id_type_key;

update notification_log set
  lead_days = case type
    when 'deadline_7d' then 7 when 'deadline_3d' then 3 when 'deadline_1d' then 1
    else null
  end,
  type = case when type like 'deadline_%' then 'deadline_reminder' else type end;

alter table notification_log
  add constraint notification_log_type_check check (type in ('new_match', 'deadline_reminder')),
  add constraint notification_log_lead_days_check check (
    (type = 'new_match' and lead_days is null)
    or (type = 'deadline_reminder' and lead_days between 1 and 30)
  );

create unique index notification_log_dedupe_idx
  on notification_log (user_id, program_id, type, coalesce(lead_days, -1));
