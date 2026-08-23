/**
 * Bounded production-safe eligibility evidence backfill.
 *
 * Usage:
 *   ELIGIBILITY_ENV_FILE=/absolute/private/.env.local npm exec tsx scripts/backfill-eligibility-sample.ts -- 3
 *
 * The hard cap of five prevents this review tool from becoming an accidental bulk AI backfill.
 * It selects active public program records that do not yet have a successful extraction.
 */
import { config } from 'dotenv';

config({ path: process.env.ELIGIBILITY_ENV_FILE ?? '.env.local', quiet: true });

import { createServiceClient } from '../lib/supabase/server';
import { persistEligibilityEvidenceForSources } from '../lib/sync/syncPrograms';
import { ELIGIBILITY_EXTRACTOR_VERSION } from '../lib/eligibility/extraction';

async function main() {
  const requested = Number(process.argv[2] ?? 3);
  if (!Number.isInteger(requested) || requested < 1 || requested > 5) {
    throw new Error('Sample size must be an integer from 1 to 5');
  }

  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'UPSTAGE_API_KEY']) {
    if (!process.env[key]) throw new Error(`${key} is required`);
  }

  const supabase = createServiceClient();
  const { data: completed, error: completedError } = await supabase
  .from('program_extraction_runs')
  .select('program_id')
  .eq('status', 'succeeded')
  .eq('extractor_version', ELIGIBILITY_EXTRACTOR_VERSION);
  if (completedError) throw new Error(`Could not inspect extraction state: ${completedError.message}`);

  const completedIds = new Set((completed ?? []).map((row) => row.program_id));
  const { data: candidates, error: candidateError } = await supabase
  .from('programs')
  .select('id,title,description,target_raw,apply_method,detail_url,updated_at')
  .eq('is_active', true)
  .not('description', 'is', null)
  .not('target_raw', 'is', null)
  .order('updated_at', { ascending: false })
  .limit(Math.max(25, requested * 10));
  if (candidateError) throw new Error(`Could not select sample programs: ${candidateError.message}`);

  const sample = (candidates ?? [])
  .filter((program) => !completedIds.has(program.id))
  .filter((program) => program.description?.trim() && program.target_raw?.trim())
  .slice(0, requested);
  if (sample.length !== requested) {
    throw new Error(`Only ${sample.length} eligible unprocessed sample programs were available`);
  }

  const results: { programId: string; title: string; outcome: 'succeeded' | 'failed'; error?: string }[] = [];
  for (const program of sample) {
    try {
      await persistEligibilityEvidenceForSources(supabase, program.id, [
      {
        sourceKey: 'summary',
        sourceType: 'api_text',
        sourceUrl: program.detail_url,
        title: '사업 내용',
        contentText: program.description ?? '',
      },
      {
        sourceKey: 'target',
        sourceType: 'api_text',
        sourceUrl: program.detail_url,
        title: '지원 대상',
        contentText: program.target_raw ?? '',
      },
      {
        sourceKey: 'application',
        sourceType: 'api_text',
        sourceUrl: program.detail_url,
        title: '신청 방법 및 서류',
        contentText: program.apply_method ?? '',
      },
      ]);
      results.push({ programId: program.id, title: program.title, outcome: 'succeeded' });
    } catch (error) {
      results.push({
        programId: program.id,
        title: program.title,
        outcome: 'failed',
        error: error instanceof Error ? error.message.slice(0, 300) : 'unknown error',
      });
    }
  }

  console.log(JSON.stringify({ requested, processed: results.length, results }, null, 2));
  if (results.some((result) => result.outcome === 'failed')) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Eligibility sample backfill failed');
  process.exitCode = 1;
});
