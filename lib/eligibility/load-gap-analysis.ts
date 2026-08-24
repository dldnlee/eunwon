import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import { ELIGIBILITY_EXTRACTOR_VERSION } from './version';
import {
  evaluateEligibilityGaps,
  type EligibilityGapRequirement,
} from './gap-analysis';

export async function loadEligibilityGapAnalysis(
  supabase: SupabaseClient,
  programId: string,
  profile: Profile
) {
  const { data: extractionRun, error: runError } = await supabase
    .from('program_extraction_runs')
    .select('id,source_fingerprint,completed_at')
    .eq('program_id', programId)
    .eq('extractor_version', ELIGIBILITY_EXTRACTOR_VERSION)
    .eq('status', 'succeeded')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) throw runError;

  const { data: rows, error: requirementsError } = extractionRun
    ? await supabase
        .from('program_eligibility_requirements')
        .select('id,requirement_type,operator,value_json,normalized_text,verification,confidence,evidence_quote,program_source_documents(title,source_url)')
        .eq('extraction_run_id', extractionRun.id)
        .order('created_at', { ascending: true })
    : { data: null, error: null };
  if (requirementsError) throw requirementsError;

  const requirements = (rows ?? []).map((row) => {
    const source = Array.isArray(row.program_source_documents)
      ? row.program_source_documents[0] ?? null
      : row.program_source_documents;
    return {
      id: row.id,
      requirementType: row.requirement_type,
      operator: row.operator,
      value: row.value_json,
      normalizedText: row.normalized_text,
      verification: row.verification,
      confidence: row.confidence,
      evidenceQuote: row.evidence_quote,
      sourceTitle: source?.title ?? null,
      sourceUrl: source?.source_url ?? null,
    } as EligibilityGapRequirement;
  });

  return { extractionRun, analysis: evaluateEligibilityGaps(requirements, profile) };
}
