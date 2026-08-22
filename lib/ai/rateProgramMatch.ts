import { generateText, parseJsonResponse } from './client';
import type { Profile } from '@/lib/types';

export interface ProgramMatchRating {
  matchRate: number; // 0-100
  reason: string;
}

/** Descriptions average ~285 chars but run up to ~700 — cap so one outlier-long
 *  description doesn't blow up the batch prompt unpredictably. */
const MAX_DESCRIPTION_CHARS = 300;

/**
 * AI second opinion on fit, batched across many programs at once. Reads each
 * program's title *and* 상세 내용 (description) — richer than title alone,
 * catching things a title's few words can't convey, while still much
 * cheaper/faster than a full per-program writeup (like explainMatch.ts does).
 * This is deliberately a secondary signal: the rule-based matchPercent() in
 * lib/matching.ts is the authoritative eligibility score (built from
 * structured fields the profile actually cleared); this catches whatever
 * the free-text content hints at that structured fields might miss — a
 * district/age/gender qualifier, a specific use case, etc. Surface both to
 * the user, don't let this replace the real one.
 */
export async function rateProgramMatches(
  programs: { id: string; title: string; description: string | null }[],
  profile: Profile
): Promise<Record<string, ProgramMatchRating>> {
  if (programs.length === 0) return {};

  const profileSummary = `- 업종: ${profile.industry_name ?? '미입력'}
- 사업 형태: ${profile.entity_type}
- 지역: ${profile.region}
- 업력: ${profile.age_months ?? '미입력'}개월
- 직원수: ${profile.employee_count ?? '미입력'}명
- 사업 내용: ${profile.business_description ?? '미입력'}
- 사업 특성: ${profile.business_traits.join(', ') || '미입력'}
- 관심 지원 분야: ${profile.interest_categories.join(', ') || '미입력'}
- 특이사항: ${profile.extra_tags.join(', ') || '미입력'}`;

  const programList = programs
    .map((p, i) => {
      const description = p.description
        ? p.description.slice(0, MAX_DESCRIPTION_CHARS)
        : '(상세 내용 없음)';
      return `${i}. 제목: ${p.title}\n상세 내용: ${description}`;
    })
    .join('\n\n');

  const text = await generateText({
    maxTokens: 200 + programs.length * 60,
    prompt: `아래는 한 회사의 정보와, 이미 기본 자격요건(지역·사업형태·업력 등)을 통과한 정부지원사업 목록입니다.
각 사업의 제목과 상세 내용을 보고 이 회사와 특히 잘 맞아 보이는지 판단해주세요. 상세 내용에 없는 조건은 추측하지 말고, 제목과 상세 내용에서 실제로 드러나는 단서(대상 지역/연령/성별/업종 한정, 사업 성격, 지원 용도 등)만 근거로 삼으세요.

회사 정보:
${profileSummary}

지원사업 목록 (번호로 구분):
${programList}

JSON 배열로만 응답하세요. 각 항목: {"index": 위 목록의 번호(정수, 그대로), "matchRate": 0~100 사이 정수 (제목과 상세 내용으로 판단한 적합도), "reason": "한 문장, 15단어 이내로 판단 근거"}
JSON 외 다른 텍스트는 절대 포함하지 마세요.`,
  });

  try {
    const parsed = parseJsonResponse<{ index?: number; matchRate?: number; reason?: string }[]>(text);
    const result: Record<string, ProgramMatchRating> = {};

    for (const entry of parsed) {
      // Correlate by list position rather than having the model echo back a 36-character UUID —
      // in practice the model occasionally garbles a UUID slightly when reproducing it, which
      // would otherwise both drop that program's rating and (before this used a validated real
      // id) corrupt a foreign-key insert. A small integer index is far less error-prone to copy.
      if (typeof entry.index !== 'number' || typeof entry.matchRate !== 'number') continue;
      const program = programs[entry.index];
      if (!program) continue;

      result[program.id] = {
        matchRate: Math.max(0, Math.min(100, Math.round(entry.matchRate))),
        reason: entry.reason ?? '',
      };
    }

    return result;
  } catch {
    console.warn('rateProgramMatches: AI response was not parseable JSON, returning no ratings');
    return {};
  }
}
