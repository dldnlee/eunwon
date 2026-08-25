import { generateText, parseJsonResponse, UPSTAGE_MODEL } from '@/lib/ai/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordAiUsage, usageCorrelationHash } from '@/lib/ai/usage-ledger';
import type { Program } from '@/lib/types';
import { buildFactSnapshot, type FactSnapshot, type GeneratedContent, type MarketingContentType } from './types';
import { validateGeneratedContent } from './validation';

export const GENERATION_VERSION = 'v1';

export interface DraftGenerationResult {
  programId: string;
  content: GeneratedContent | null;
  factSnapshot: FactSnapshot;
  validationErrors: string[];
}

function buildPrompt(snapshot: FactSnapshot, contentType: MarketingContentType): string {
  return `당신은 한국 정부지원사업 정보를 소상공인·창업자에게 전하는 인스타그램 카드뉴스 카피라이터입니다.
아래 "사실 스냅샷"에 적힌 공식 정보만 사용하세요. 스냅샷에 없는 금액, 날짜, 자격 요건을 절대 만들어내지 마세요.

[사실 스냅샷]
${JSON.stringify(snapshot, null, 2)}

[요청]
- content_type: ${contentType}
- 아래 JSON 스키마 그대로, 한국어로, JSON 외 텍스트 없이 응답하세요.
- slides는 3~7개로, 마지막 슬라이드는 반드시 type "cta" 하나여야 합니다.
- 각 슬라이드 headline은 40자 이하, body는 200자 이하, bullets는 80자 이하 5개 이하입니다.
- caption은 인스타그램 캡션(2200자 이하)이며 반드시 원본 공고 링크(${snapshot.source_url})를 포함해야 합니다.
- 금액을 언급한다면 스냅샷의 funding_amount_krw와 정확히 같은 값(억원/만원 단위 환산 허용)으로만 쓰세요. 근거 없는 금액은 쓰지 마세요.
- 마감일을 쓴다면 YYYY-MM-DD 또는 YYYY.MM.DD 형식으로 스냅샷의 날짜와 정확히 일치하게 쓰세요.
- "최고", "가장 좋은", "무조건" 같은 과장 표현과 "받을 수 있습니다" 단정 대신 "확인 대상", "예상 매칭" 같은 표현을 쓰세요.
- hashtags는 3~15개, "#" 없이 문자열로 제공하세요.
- disclaimer에는 "최종 신청 자격은 공식 공고를 확인해주세요." 류의 문장을 포함하세요.

[응답 스키마]
{
  "contentType": "${contentType}",
  "audience": "...",
  "hook": "...",
  "slides": [
    { "type": "hook" | "eligibility" | "benefit" | "deadline", "headline": "...", "body": "..." },
    ...
    { "type": "cta", "headline": "...", "body": "..." }
  ],
  "caption": "...",
  "disclaimer": "...",
  "sourceLabel": "${snapshot.agency} 공고",
  "hashtags": ["..."]
}`;
}

/**
 * Generates one structured draft from a program's frozen fact snapshot and validates it
 * deterministically. Returns validation errors instead of throwing when the model output
 * is unusable — the caller persists those on a `validation_failed` post row.
 */
export async function generateDraftForProgram(
  supabase: SupabaseClient,
  program: Program,
  contentType: MarketingContentType = 'program_spotlight',
): Promise<DraftGenerationResult> {
  const factSnapshot = buildFactSnapshot(program);
  const startedAt = new Date().toISOString();

  let raw: string;
  try {
    raw = await generateText({ prompt: buildPrompt(factSnapshot, contentType), maxTokens: 2000 });
  } catch (err) {
    await recordUsage(supabase, program.id, startedAt, new Date().toISOString(), 'provider_error', 'provider');
    throw err;
  }
  const completedAt = new Date().toISOString();

  let parsed: unknown;
  try {
    parsed = parseJsonResponse(raw);
  } catch {
    // The ledger has no invalid_response outcome — an unusable response is a provider failure.
    await recordUsage(supabase, program.id, startedAt, completedAt, 'provider_error', 'invalid_response');
    return {
      programId: program.id,
      content: null,
      factSnapshot,
      validationErrors: ['모델 응답을 JSON으로 파싱하지 못했습니다'],
    };
  }

  const validation = validateGeneratedContent(parsed, factSnapshot);
  await recordUsage(supabase, program.id, startedAt, completedAt, 'succeeded', null);

  // Content is returned even when validation fails so reviewers can inspect what went wrong
  // in the dashboard; publishing stays blocked by the row status.
  return {
    programId: program.id,
    content: parsed as GeneratedContent,
    factSnapshot,
    validationErrors: validation.errors,
  };
}

async function recordUsage(
  supabase: SupabaseClient,
  programId: string,
  startedAt: string,
  completedAt: string,
  outcome: 'succeeded' | 'provider_error',
  errorCategory: 'provider' | 'invalid_response' | null,
): Promise<void> {
  try {
    await recordAiUsage(supabase, {
      userId: null,
      attributionClass: 'admin_operation',
      feature: 'marketing_content_generation',
      action: 'marketing_draft_generate',
      provider: 'upstage',
      model: UPSTAGE_MODEL,
      inputTokens: null,
      outputTokens: null,
      outcome,
      errorCategory,
      correlationHash: usageCorrelationHash(`marketing-draft:${programId}:${startedAt}`),
      startedAt,
      completedAt,
    });
  } catch (err) {
    console.error('Failed to record marketing AI usage:', err);
  }
}
