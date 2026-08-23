-- Narrow beta hardening after migrations 011-014.
-- Keep the tracker transition RPC authenticated-only and make service-role-only
-- eligibility writes explicit at the grant layer as well as through RLS.

revoke execute on function public.transition_saved_program(uuid, text) from public;
revoke execute on function public.transition_saved_program(uuid, text) from anon;
grant execute on function public.transition_saved_program(uuid, text) to authenticated;

revoke insert, update, delete, truncate
  on table public.program_source_documents,
           public.program_extraction_runs,
           public.program_eligibility_requirements
  from anon, authenticated;

create index saved_program_status_history_user_idx
  on public.saved_program_status_history (user_id);

create index saved_events_event_idx
  on public.saved_events (event_id);

create index event_notification_log_event_idx
  on public.event_notification_log (event_id);
