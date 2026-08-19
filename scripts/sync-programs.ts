// scripts/sync-programs.ts
// Run with: npm run sync
//
// Required env vars (in .env.local):
//   BIZINFO_API_KEY   — from data.go.kr (use decoded == not %3D%3D)
//   UPSTAGE_API_KEY   — from console.upstage.ai
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { config } from 'dotenv';
config({ path: '.env.local' });

import { syncPrograms } from '../lib/sync/syncPrograms';

syncPrograms().catch((err) => {
  console.error(err);
  process.exit(1);
});
