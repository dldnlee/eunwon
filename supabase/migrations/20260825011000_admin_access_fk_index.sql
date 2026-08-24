-- Advisor follow-up for the server-managed role assignment audit relationship.
create index admin_role_assignments_assigned_by_idx
  on public.admin_role_assignments (assigned_by)
  where assigned_by is not null;
