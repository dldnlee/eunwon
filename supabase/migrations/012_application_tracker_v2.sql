-- Expands saved programs into an auditable application tracker with a concrete next action.
-- Existing values are migrated without losing selected/rejected outcomes.

alter table saved_programs drop constraint saved_programs_status_check;

update saved_programs set status = case status
  when 'saved' then 'considering'
  when 'applied' then 'submitted'
  else status
end;

alter table saved_programs
  alter column status set default 'considering',
  add column submitted_at date,
  add column next_action text check (char_length(next_action) <= 500),
  add column next_action_due_at date,
  add column updated_at timestamptz not null default now(),
  add constraint saved_programs_status_check check (status in (
    'considering', 'preparing', 'submitted', 'screening', 'interview',
    'selected', 'rejected', 'withdrawn'
  ));

-- Existing `applied` rows became submitted above. Their exact submission date was never captured,
-- so leave it null rather than inventing one.

create table saved_program_status_history (
  id               uuid primary key default gen_random_uuid(),
  saved_program_id uuid not null references saved_programs(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  from_status      text not null,
  to_status        text not null,
  changed_at       timestamptz not null default now(),
  check (from_status in (
    'considering', 'preparing', 'submitted', 'screening', 'interview',
    'selected', 'rejected', 'withdrawn'
  )),
  check (to_status in (
    'considering', 'preparing', 'submitted', 'screening', 'interview',
    'selected', 'rejected', 'withdrawn'
  ))
);

create index saved_program_status_history_saved_idx
  on saved_program_status_history (saved_program_id, changed_at desc);
create index saved_programs_next_action_idx
  on saved_programs (user_id, next_action_due_at)
  where next_action is not null;

alter table saved_program_status_history enable row level security;

create policy "users can read own saved program history"
  on saved_program_status_history for select
  using (auth.uid() = user_id);

-- Atomic transition: ownership, transition validation, row update, and history append happen in
-- one transaction. SECURITY DEFINER is limited to this exact operation and checks auth.uid().
create or replace function transition_saved_program(
  p_saved_program_id uuid,
  p_to_status text
)
returns saved_programs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row saved_programs;
  updated_row saved_programs;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into current_row
  from saved_programs
  where id = p_saved_program_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'saved program not found' using errcode = 'P0002';
  end if;

  if p_to_status not in (
    'considering', 'preparing', 'submitted', 'screening', 'interview',
    'selected', 'rejected', 'withdrawn'
  ) then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  if current_row.status = p_to_status then
    return current_row;
  end if;

  -- Active stages may be corrected or advanced freely. A terminal result must be explicitly
  -- restarted at considering before entering another active stage.
  if current_row.status in ('selected', 'rejected', 'withdrawn')
     and p_to_status <> 'considering' then
    raise exception 'terminal status must restart at considering' using errcode = '22023';
  end if;

  update saved_programs
  set status = p_to_status,
      submitted_at = case
        when p_to_status = 'submitted' and submitted_at is null then current_date
        else submitted_at
      end,
      updated_at = now()
  where id = current_row.id
  returning * into updated_row;

  insert into saved_program_status_history (
    saved_program_id, user_id, from_status, to_status
  ) values (
    current_row.id, current_row.user_id, current_row.status, p_to_status
  );

  return updated_row;
end;
$$;

revoke all on function transition_saved_program(uuid, text) from public;
grant execute on function transition_saved_program(uuid, text) to authenticated;

-- Record the migrated state as the starting point of the new timeline.
insert into saved_program_status_history (saved_program_id, user_id, from_status, to_status, changed_at)
select id, user_id, status, status, created_at from saved_programs;
