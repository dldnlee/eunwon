import { generateText } from './client';
import type { Program, Profile } from '@/lib/types';

/**
 * A 사업계획서 outline with per-section writing guidance, scoped to one
 * program and one user's profile. Pro-only.
 */
export async function draftApplicationOutline(
  program: Program,
  profile: Profile
): Promise<string> {
  return generateText({
    maxTokens: 1024,
    prompt: `다음 정부지원사업 신청을 위한 사업계획서 목차와 각 항목의 작성 가이드를 제공해주세요.

지원사업: ${program.title}
지원내용: ${program.ai_summary ?? program.description ?? ''}
신청기업 업종: ${profile.business_type}
신청기업 지역: ${profile.region}

실용적이고 구체적인 작성 가이드를 마크다운 형식으로 제공하세요.`,
  });
}
