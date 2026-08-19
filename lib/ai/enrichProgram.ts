import { generateText, parseJsonResponse } from './client';

export interface ProgramEnrichment {
  summary: string;
  tags: string[];
  category: string;
  key_benefit: string;
}

/**
 * Analyze a raw program description into structured, plain-Korean fields.
 * Runs once per program at ingestion time — not per user request.
 */
export async function enrichProgram(
  rawDescription: string,
  title: string
): Promise<ProgramEnrichment> {
  const text = await generateText({
    maxTokens: 512,
    prompt: `다음 정부지원사업의 설명을 분석해서 JSON으로 반환해주세요.

사업명: ${title}
설명: ${rawDescription}

다음 형식으로만 응답하세요 (JSON 외 다른 텍스트 없이):
{
  "summary": "2-3문장으로 핵심만 요약한 한국어 설명",
  "tags": ["관련태그1", "관련태그2"],
  "category": "융자|보조금|보증|교육|컨설팅|기타",
  "key_benefit": "핵심 혜택 한 줄 요약"
}`,
  });

  return parseJsonResponse<ProgramEnrichment>(text);
}
