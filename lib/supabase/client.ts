import { createBrowserClient } from '@supabase/ssr';

// No generated `Database` type is wired in yet (see lib/types.ts) — run
// `supabase gen types typescript` once the project is linked and pass it
// here as `createBrowserClient<Database>(...)` for full query typing.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
