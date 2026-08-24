-- Remove the anonymous account-enumeration surface. Supabase Auth intentionally returns
-- non-enumerating signup responses; the application handles that response without exposing
-- a public auth.users lookup.

revoke all on function public.email_is_registered(text) from public, anon, authenticated;
drop function if exists public.email_is_registered(text);
