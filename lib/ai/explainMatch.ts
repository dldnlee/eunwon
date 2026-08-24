import { generateText } from './client';
import type { Program, Profile } from '@/lib/types';
import type { EligibilityGapAnalysis } from '@/lib/eligibility/gap-analysis';

/**
 * Personalized 1-2 sentence explanation of why a program fits this user's
 * business. Pro-only, generated at dashboard load time.
 */
export async function explainMatch(
  program: Program,
  profile: Profile,
  gapAnalysis?: EligibilityGapAnalysis,
  generate: typeof generateText = generateText
): Promise<string> {
  const mismatches = gapAnalysis?.items.filter((item) => item.status === 'not_met') ?? [];
  if (mismatches.length > 0) {
    return `현재 프로필 정보상 “${mismatches[0].requirement}” 조건과 맞지 않을 수 있어요. 자격을 단정하지 말고 공고 원문과 담당 기관에서 먼저 확인해 주세요.`;
  }

  const metFacts = gapAnalysis?.items.filter((item) => item.status === 'met')
    .map((item) => item.evidenceQuote ?? item.requirement).slice(0, 5) ?? [];
  const unknownFacts = gapAnalysis?.items.filter((item) => item.status === 'unknown')
    .map((item) => item.requirement).slice(0, 5) ?? [];
  const text = await generate({
    maxTokens: 200,
    prompt: `사용자의 사업과 지원사업의 매칭 이유를 1-2문장으로 설명해주세요.

사용자 정보:
- 업종: ${profile.industry_name ?? '미입력'}
- 지역: ${profile.region}
- 업력: ${profile.age_months ?? '미입력'}개월
- 직원수: ${profile.employee_count ?? '미입력'}명
- 사업 내용: ${profile.business_description ?? '미입력'}
- 사업 특성: ${profile.business_traits.join(', ') || '미입력'}
- 연구개발 역량: ${profile.rnd_capability.join(', ') || '미입력'}
- 투자유치 현황: ${profile.investment_stage ?? '미입력'}
- 과세유형: ${profile.business_tax_type ?? '미입력'}

지원사업: ${program.title}
요약: ${program.ai_summary ?? program.description ?? ''}
출처 기반으로 확인된 일치 조건: ${metFacts.join(' / ') || '없음'}
확인 필요 조건: ${unknownFacts.join(' / ') || '없음'}

위에 제공된 정보만 사용하세요. 확인 필요 조건을 충족한다고 가정하지 말고, 자격이나 선정
가능성을 확정하지 마세요. 확인된 일치 조건이 없으면 적합하다고 말하지 마세요. 친근하고
명확한 한국어로 작성하세요.`,
  });

  return text.trim();
}
