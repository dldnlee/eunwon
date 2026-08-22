// scripts/sync-events.ts
// Run with: npm run sync:events
//
// Required env vars (in .env.local):
//   BIZINFO_EVENT_API_KEY   — see lib/sync/syncEvents.ts header
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { config } from 'dotenv';
config({ path: '.env.local' });

import { syncEvents } from '../lib/sync/syncEvents';

syncEvents().catch((err) => {
  console.error(err);
  process.exit(1);
});
