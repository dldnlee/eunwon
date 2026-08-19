import { generateText } from './client';
import type { Program, Profile } from '@/lib/types';
import { getAgeMonths } from '@/lib/utils';

/**
 * Personalized 1-2 sentence explanation of why a program fits this user's
 * business. Pro-only, generated at dashboard load time.
 */
export async function explainMatch(program: Program, profile: Profile): Promise<string> {
  const text = await generateText({
    maxTokens: 200,
    prompt: `사용자의 사업과 지원사업의 매칭 이유를 1-2문장으로 설명해주세요.

사용자 정보:
- 업종: ${profile.business_type}
- 지역: ${profile.region}
- 업력: ${getAgeMonths(profile.founded_at)}개월
- 직원수: ${profile.employee_count ?? '미입력'}명

지원사업: ${program.title}
요약: ${program.ai_summary ?? program.description ?? ''}

왜 이 사업이 이 사용자에게 적합한지 구체적으로 설명하세요. 친근하고 명확한 한국어로 작성하세요.`,
  });

  return text.trim();
}
