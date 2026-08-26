import { generateText } from './client';
import type { Program, Profile } from '@/lib/types';

/**
 * Full 사업계획서 draft — 사업 개요 → 신청 배경 → 추진 계획 → 기대 효과, written directly
 * from the user's real profile and the program's actual requirements. Pro-only,
 * the anchor feature for paid conversion (see docs/eunwon-master.md).
 */
export async function generateDocument(program: Program, profile: Profile): Promise<string> {
  const revenueEok = profile.annual_revenue_krw != null ? (profile.annual_revenue_krw / 100_000_000).toFixed(1) : null;

  return generateText({
    maxTokens: 2000,
    prompt: `다음 정보를 바탕으로 정부지원사업 신청서를 작성해주세요.

[기업 정보]
- 업종: ${profile.industry_name ?? '미입력'}
- 창업일: ${profile.founded_at ?? '미입력'} (업력 ${profile.age_months ?? '미입력'}개월)
- 소재지: ${profile.region}
- 종업원 수: ${profile.employee_count ?? '미입력'}명
- 연매출: ${revenueEok ? `${revenueEok}억원` : '미입력'}
- 사업 내용: ${profile.business_description ?? '미입력'}
- 사업 특성: ${profile.business_traits.join(', ') || '미입력'}
- 연구개발 역량: ${profile.rnd_capability.join(', ') || '미입력'}
- 투자유치 현황: ${profile.investment_stage ?? '미입력'}
- 현재 과제: ${profile.current_challenges ?? '미입력'}

[지원사업 정보]
- 사업명: ${program.title}
- 주관기관: ${program.agency}
- 지원 내용: ${program.ai_summary ?? program.description ?? ''}

형식: 마크다운으로 작성하고, 사업 개요 → 신청 배경 → 추진 계획 → 기대 효과 순서로 각 섹션을 "## 제목" 형식의 헤딩으로 구분해주세요.
각 섹션 안에서는 필요에 따라 문단과 "- " 글머리 기호 목록을 사용해주세요.
실제 신청서에 바로 붙여넣을 수 있는 수준으로 작성해주세요.`,
  });
}
