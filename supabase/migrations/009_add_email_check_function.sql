-- Lets the /signup page check "is this email already registered?" live, without
-- calling supabase.auth.signUp() just to probe (which would hit Auth's signup
-- rate limit) and without the app needing service-role access client-side.
--
-- The Admin SDK's listUsers() has no email filter (would require paginating
-- every user to find a match), so this goes straight at auth.users instead.
-- SECURITY DEFINER runs as the function owner (which has access to the auth
-- schema); search_path is pinned to prevent search_path hijacking. Only a
-- boolean is ever returned — no other user data is exposed.
--
-- Note: by nature, this endpoint lets an unauthenticated caller test whether
-- a given address has an account (the same trade-off any "email already
-- taken" live-validation UI makes) — acceptable here since that's exactly
-- the feature being built, but worth knowing if this app's threat model
-- ever changes.

create or replace function public.email_is_registered(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(check_email)
  );
$$;

grant execute on function public.email_is_registered(text) to anon, authenticated;
