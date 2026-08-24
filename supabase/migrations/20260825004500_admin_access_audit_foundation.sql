-- T20 Stage A: server-controlled admin roles and append-only audit foundation.
-- No human operator is assigned by this migration and no customer data is exposed.

create table public.admin_role_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('support_readonly', 'content_reviewer', 'billing_operator', 'admin_owner')),
  assigned_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  target_type text not null check (char_length(target_type) between 2 and 100),
  target_id text check (target_id is null or char_length(target_id) <= 200),
  safe_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_summary) = 'object'),
  reason text check (reason is null or char_length(reason) between 3 and 500),
  request_id text check (request_id is null or char_length(request_id) <= 200),
  created_at timestamptz not null default now()
);

create index admin_role_assignments_role_idx on public.admin_role_assignments (role);
create index admin_audit_events_actor_created_idx on public.admin_audit_events (actor_user_id, created_at desc);
create index admin_audit_events_target_created_idx on public.admin_audit_events (target_type, target_id, created_at desc);

alter table public.admin_role_assignments enable row level security;
alter table public.admin_audit_events enable row level security;

-- Intentionally no direct table policies: ordinary authenticated clients are default-denied.
revoke all on table public.admin_role_assignments from public, anon, authenticated;
revoke all on table public.admin_audit_events from public, anon, authenticated;

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
        when 'content_reviewer' then requested_capability = any (array['admin_access', 'user_read', 'notification_read', 'import_read', 'eligibility_review', 'audit_write'])
        when 'billing_operator' then requested_capability = any (array['admin_access', 'user_read', 'billing_read', 'billing_manage', 'audit_write'])
        when 'admin_owner' then requested_capability = any (array['admin_access', 'user_read', 'notification_read', 'import_read', 'eligibility_review', 'billing_read', 'billing_manage', 'role_manage', 'audit_read', 'audit_write'])
        else false
      end
  );
$$;

revoke execute on function public.has_admin_capability(text) from public, anon;
grant execute on function public.has_admin_capability(text) to authenticated, service_role;

create or replace function public.record_admin_audit_event(
  event_action text,
  event_target_type text,
  event_target_id text default null,
  event_safe_summary jsonb default '{}'::jsonb,
  event_reason text default null,
  event_request_id text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if not public.has_admin_capability('audit_write') then
    raise exception 'admin capability required' using errcode = '42501';
  end if;
  insert into public.admin_audit_events (
    actor_user_id, action, target_type, target_id, safe_summary, reason, request_id
  ) values (
    (select auth.uid()), event_action, event_target_type, event_target_id,
    coalesce(event_safe_summary, '{}'::jsonb), event_reason, event_request_id
  ) returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.record_admin_audit_event(text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.record_admin_audit_event(text, text, text, jsonb, text, text) to authenticated, service_role;

create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'admin audit events are append-only' using errcode = '42501';
end;
$$;

create trigger admin_audit_events_append_only
before update or delete on public.admin_audit_events
for each row execute function public.prevent_admin_audit_mutation();

revoke execute on function public.prevent_admin_audit_mutation() from public, anon, authenticated;

create or replace function public.audit_admin_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.admin_audit_events (actor_user_id, action, target_type, target_id, safe_summary, reason)
  values (
    (select auth.uid()),
    case tg_op when 'INSERT' then 'admin_role.assigned' when 'UPDATE' then 'admin_role.changed' else 'admin_role.revoked' end,
    'admin_role_assignment',
    coalesce(new.user_id, old.user_id)::text,
    jsonb_build_object('role', coalesce(new.role, old.role)),
    coalesce(new.reason, old.reason)
  );
  return coalesce(new, old);
end;
$$;

create trigger admin_role_assignment_audit
after insert or update or delete on public.admin_role_assignments
for each row execute function public.audit_admin_role_assignment();

revoke execute on function public.audit_admin_role_assignment() from public, anon, authenticated;
