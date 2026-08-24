import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Program } from './types';
import { getMatchedPrograms } from './matching';

export interface SimilarProgramRecommendation {
  program: Program;
  score: number;
  reasons: string[];
  differences: string[];
}

function overlap(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return Array.from(new Set(left.filter((value) => rightSet.has(value.toLowerCase()))));
}

function titleTerms(title: string): string[] {
  return title.toLowerCase().split(/[^0-9a-z가-힣]+/).filter((term) => term.length >= 2);
}

export function rankSimilarPrograms(
  current: Program,
  candidates: Program[],
  options: { limit?: number; today?: string } = {}
): SimilarProgramRecommendation[] {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  return candidates
    .filter((candidate) => candidate.id !== current.id && candidate.is_active)
    .filter((candidate) => !candidate.deadline_end || candidate.deadline_end >= today)
    .map((program) => {
      let score = 0;
      const reasons: string[] = [];
      const differences: string[] = [];
      if (current.category && current.category === program.category) {
        score += 30; reasons.push(`같은 ${current.category} 분야예요.`);
      } else if (current.category || program.category) {
        differences.push(`분야: ${program.category ?? '확인 필요'}`);
      }
      if (current.funding_type && current.funding_type === program.funding_type) {
        score += 15; reasons.push(`지원 방식이 ${current.funding_type}(으)로 같아요.`);
      } else if (current.funding_type || program.funding_type) {
        differences.push(`지원 방식: ${program.funding_type ?? '확인 필요'}`);
      }
      if (current.agency === program.agency) {
        score += 10; reasons.push('같은 기관의 공고예요.');
      }
      const sharedRegions = current.is_nationwide || program.is_nationwide
        ? [] : overlap(current.region, program.region);
      if (current.is_nationwide && program.is_nationwide) {
        score += 10; reasons.push('둘 다 전국 대상이에요.');
      } else if (sharedRegions.length > 0) {
        score += 15; reasons.push(`${sharedRegions.join(', ')} 지역 조건이 겹쳐요.`);
      } else {
        differences.push(`지역: ${program.is_nationwide ? '전국' : program.region.join(', ') || '확인 필요'}`);
      }
      const sharedEntities = overlap(current.entity_types, program.entity_types);
      if (sharedEntities.length > 0) {
        score += 10; reasons.push(`대상 유형 ${sharedEntities.slice(0, 2).join(', ')}이 겹쳐요.`);
      }
      const sharedTags = overlap(current.ai_tags ?? [], program.ai_tags ?? []);
      if (sharedTags.length > 0) {
        score += Math.min(10, sharedTags.length * 3);
        reasons.push(`공통 주제: ${sharedTags.slice(0, 3).join(', ')}`);
      }
      const sharedTerms = overlap(titleTerms(current.title), titleTerms(program.title));
      if (sharedTerms.length > 0) score += Math.min(15, sharedTerms.length * 5);
      if (current.deadline_end !== program.deadline_end) {
        differences.push(`마감: ${program.deadline_end ?? '상시/확인 필요'}`);
      }
      return { program, score: Math.min(100, score), reasons, differences };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.program.deadline_end ?? '9999').localeCompare(b.program.deadline_end ?? '9999'))
    .slice(0, options.limit ?? 3);
}

export async function getSimilarPrograms(
  supabase: SupabaseClient,
  current: Program,
  profile: Profile,
  limit = 3
): Promise<SimilarProgramRecommendation[]> {
  // This candidate set has already passed the same hard region/entity/age/size/revenue filters as
  // the dashboard. Similarity can reorder candidates but can never bypass those filters.
  const eligibleCandidates = await getMatchedPrograms(supabase, profile, { limit: 100 });
  return rankSimilarPrograms(current, eligibleCandidates, { limit });
}
