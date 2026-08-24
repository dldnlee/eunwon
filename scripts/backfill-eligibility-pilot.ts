/**
 * Reviewed 25-program eligibility evidence pilot.
 *
 * Usage:
 *   ELIGIBILITY_ENV_FILE=/absolute/private/.env.local npm run backfill:eligibility:pilot -- --confirm-25
 *
 * Safety boundaries: exactly 25 candidates, concurrency 1, no automatic retries, no source over
 * 20,000 characters, and a 250,000-token observed/preflight ceiling. This is not a bulk runner.
 */
import { config } from 'dotenv';

config({ path: process.env.ELIGIBILITY_ENV_FILE ?? '.env.local', quiet: true });

import { generateText } from '../lib/ai/client';
import { ELIGIBILITY_EXTRACTOR_VERSION, extractEligibilityRequirements, prepareEligibilitySources } from '../lib/eligibility/extraction';
import { createServiceClient } from '../lib/supabase/server';
import { persistEligibilityEvidenceForSources } from '../lib/sync/syncPrograms';

const PILOT_SIZE = 25;
const MAX_SOURCE_CHARS = 20_000;
const MAX_TOTAL_TOKENS = 250_000;
const MAX_OUTPUT_TOKENS_PER_REQUEST = 1_800;

type Candidate = {
  id: string;
  title: string;
  description: string | null;
  target_raw: string | null;
  apply_method: string | null;
  detail_url: string | null;
};

function sourceInputs(program: Candidate) {
  return [
    { sourceKey: 'summary', sourceType: 'api_text' as const, sourceUrl: program.detail_url, title: '사업 내용', contentText: program.description ?? '' },
    { sourceKey: 'target', sourceType: 'api_text' as const, sourceUrl: program.detail_url, title: '지원 대상', contentText: program.target_raw ?? '' },
    { sourceKey: 'application', sourceType: 'api_text' as const, sourceUrl: program.detail_url, title: '신청 방법 및 서류', contentText: program.apply_method ?? '' },
  ];
}

function conservativeRequestTokens(program: Candidate): number {
  const sourceCharacters = prepareEligibilitySources(sourceInputs(program))
    .reduce((total, source) => total + source.contentText.length, 0);
  // Korean text can approach one token per character. Add a fixed prompt/schema allowance and the
  // model's hard output cap so the request is budgeted before it is sent.
  return sourceCharacters + 4_000 + MAX_OUTPUT_TOKENS_PER_REQUEST;
}

async function main() {
  if (!process.argv.includes('--confirm-25')) {
    throw new Error('Pilot requires the explicit --confirm-25 acknowledgement');
  }
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'UPSTAGE_API_KEY']) {
    if (!process.env[key]) throw new Error(`${key} is required`);
  }

  const resumeCompletedArg = process.argv.find((arg) => arg.startsWith('--resume-completed='));
  const priorTokensArg = process.argv.find((arg) => arg.startsWith('--prior-tokens='));
  const resumeCompleted = Number(resumeCompletedArg?.split('=')[1] ?? 0);
  const priorTokens = Number(priorTokensArg?.split('=')[1] ?? 0);
  if (!Number.isInteger(resumeCompleted) || resumeCompleted < 0 || resumeCompleted >= PILOT_SIZE) {
    throw new Error('resume-completed must be an integer from 0 to 24');
  }
  if (!Number.isInteger(priorTokens) || priorTokens < 0 || priorTokens >= MAX_TOTAL_TOKENS) {
    throw new Error('prior-tokens must be a non-negative integer below the token ceiling');
  }
  if ((resumeCompleted === 0) !== (priorTokens === 0)) {
    throw new Error('resume-completed and prior-tokens must be supplied together');
  }
  const requested = PILOT_SIZE - resumeCompleted;

  const supabase = createServiceClient();
  const { data: completed, error: completedError } = await supabase
    .from('program_extraction_runs').select('program_id')
    .eq('status', 'succeeded').eq('extractor_version', ELIGIBILITY_EXTRACTOR_VERSION);
  if (completedError) throw new Error(`Could not inspect extraction state: ${completedError.message}`);
  const completedIds = new Set((completed ?? []).map((row) => row.program_id));

  const { data, error: candidateError } = await supabase.from('programs')
    .select('id,title,description,target_raw,apply_method,detail_url,updated_at')
    .eq('is_active', true).not('description', 'is', null).not('target_raw', 'is', null)
    .order('updated_at', { ascending: false }).limit(500);
  if (candidateError) throw new Error(`Could not select pilot programs: ${candidateError.message}`);

  const candidates = ((data ?? []) as Candidate[])
    .filter((program) => !completedIds.has(program.id))
    .filter((program) => program.description?.trim() && program.target_raw?.trim())
    .filter((program) => sourceInputs(program).reduce((sum, source) => sum + source.contentText.length, 0) <= MAX_SOURCE_CHARS)
    .slice(0, requested);
  if (candidates.length !== requested) throw new Error(`Only ${candidates.length} of ${requested} bounded pilot candidates were available`);

  const preflightTokens = candidates.reduce((sum, program) => sum + conservativeRequestTokens(program), 0);
  if (priorTokens + preflightTokens > MAX_TOTAL_TOKENS) {
    throw new Error(`Pilot preflight plus prior usage exceeds ${MAX_TOTAL_TOKENS} token ceiling`);
  }

  let observedInputTokens = 0;
  let observedOutputTokens = 0;
  let observedTotalTokens = 0;
  let consecutiveFailures = 0;
  const results: Array<{ programId: string; title: string; outcome: 'succeeded' | 'failed'; error?: string }> = [];

  for (const program of candidates) {
    const requestBudget = conservativeRequestTokens(program);
    if (priorTokens + observedTotalTokens + requestBudget > MAX_TOTAL_TOKENS) {
      throw new Error(`Stopped before ${program.id}: observed plus next-request budget exceeds token ceiling`);
    }
    try {
      await persistEligibilityEvidenceForSources(supabase, program.id, sourceInputs(program), {
        extract: (sources) => extractEligibilityRequirements(sources, (params) => generateText({
          ...params,
          maxTokens: Math.min(params.maxTokens ?? MAX_OUTPUT_TOKENS_PER_REQUEST, MAX_OUTPUT_TOKENS_PER_REQUEST),
          onUsage: (usage) => {
            observedInputTokens += usage.inputTokens;
            observedOutputTokens += usage.outputTokens;
            observedTotalTokens += usage.totalTokens;
          },
        })),
      });
      consecutiveFailures = 0;
      results.push({ programId: program.id, title: program.title, outcome: 'succeeded' });
    } catch (error) {
      consecutiveFailures += 1;
      results.push({ programId: program.id, title: program.title, outcome: 'failed', error: error instanceof Error ? error.message.slice(0, 300) : 'unknown error' });
      const failures = results.filter((result) => result.outcome === 'failed').length;
      if (consecutiveFailures >= 2 || failures / results.length > 0.10) break;
    }
  }

  console.log(JSON.stringify({
    policy: { pilotSize: PILOT_SIZE, resumeCompleted, requested, priorTokens, maxSourceChars: MAX_SOURCE_CHARS, maxTotalTokens: MAX_TOTAL_TOKENS, concurrency: 1, retries: 0 },
    preflightTokens,
    observedUsage: { inputTokens: observedInputTokens, outputTokens: observedOutputTokens, totalTokens: observedTotalTokens },
    processed: results.length,
    succeeded: results.filter((result) => result.outcome === 'succeeded').length,
    failed: results.filter((result) => result.outcome === 'failed').length,
    results,
  }, null, 2));
  if (results.length !== requested || results.some((result) => result.outcome === 'failed')) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Eligibility pilot failed');
  process.exitCode = 1;
});
