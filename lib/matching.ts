import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Program } from '@/lib/types';
import { getAgeMonths } from '@/lib/utils';

export interface MatchOptions {
  limit?: number;
}

/**
 * Pure SQL filtering — no AI involved. A program matches when every
 * numeric/eligibility bound is either unset (no restriction) or satisfied.
 * Region and entity_type are the only hard requirements.
 */
export async function getMatchedPrograms(
  supabase: SupabaseClient,
  profile: Profile,
  options: MatchOptions = {}
): Promise<Program[]> {
  const ageMonths = getAgeMonths(profile.founded_at);
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .or(`deadline_end.is.null,deadline_end.gte.${today}`)
    .or(`region.cs.{"전국"},region.cs.{"${profile.region}"}`)
    .or(
      profile.employee_count != null
        ? `min_employees.is.null,min_employees.lte.${profile.employee_count}`
        : 'min_employees.is.null,min_employees.gte.0'
    )
    .or(
      profile.employee_count != null
        ? `max_employees.is.null,max_employees.gte.${profile.employee_count}`
        : 'max_employees.is.null,max_employees.gte.0'
    )
    .or(`min_age_months.is.null,min_age_months.lte.${ageMonths}`)
    .or(`max_age_months.is.null,max_age_months.gte.${ageMonths}`)
    .contains('entity_types', [profile.entity_type])
    .order('deadline_end', { ascending: true, nullsFirst: false })
    .limit(options.limit ?? 50);

  if (error) throw error;
  return data ?? [];
}

/**
 * Relevance score for ranking — counts how many *optional* criteria a
 * program also satisfies beyond the hard region/entity_type match, so
 * more specifically-targeted programs surface first.
 */
export function scoreMatch(program: Program, profile: Profile): number {
  let score = 0;
  const ageMonths = getAgeMonths(profile.founded_at);

  if (program.business_types?.includes(profile.business_type)) score += 2;
  if (profile.employee_count != null) {
    if (program.min_employees != null || program.max_employees != null) score += 1;
  }
  if (program.max_age_months != null && program.max_age_months >= ageMonths) score += 1;
  if (!program.is_nationwide) score += 1; // region-specific programs rank slightly higher for a local user
  if (profile.extra_tags.some((tag) => program.ai_tags?.includes(tag))) score += 1;

  return score;
}
