import { createHash } from 'node:crypto';
import { z } from 'zod';
import { generateText, parseJsonResponse, UPSTAGE_MODEL } from '../ai/client';
import { ELIGIBILITY_EXTRACTOR_VERSION } from './version';

export { ELIGIBILITY_EXTRACTOR_VERSION } from './version';

export const REQUIREMENT_TYPES = [
  'entity_type', 'region', 'business_age', 'employee_count', 'annual_revenue',
  'industry', 'business_trait', 'technology_domain', 'certification', 'extra_tag',
  'rnd_capability', 'investment_stage', 'exclusion', 'other',
] as const;

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];
export type SourceType = 'api_text' | 'html' | 'pdf' | 'hwpx' | 'hwp';

export interface EligibilitySourceInput {
  sourceKey: string;
  sourceType: SourceType;
  sourceUrl?: string | null;
  title?: string | null;
  contentText: string;
}

export interface PreparedEligibilitySource extends EligibilitySourceInput {
  contentSha256: string;
}

export interface ValidatedEligibilityRequirement {
  requirementType: RequirementType;
  operator: 'eq' | 'in' | 'gte' | 'lte' | 'between' | 'contains' | 'excludes';
  value: unknown;
  normalizedText: string;
  sourceKey: string | null;
  evidenceQuote: string | null;
  evidenceStart: number | null;
  evidenceEnd: number | null;
  verification: 'verified' | 'inferred';
  confidence: number;
}

const rawRequirementSchema = z.object({
  requirement_type: z.enum(REQUIREMENT_TYPES),
  operator: z.enum(['eq', 'in', 'gte', 'lte', 'between', 'contains', 'excludes']),
  value: z.union([
    z.string(), z.number(), z.boolean(), z.array(z.json()), z.record(z.string(), z.json()),
  ]),
  normalized_text: z.string().min(1),
  source_key: z.string().min(1).nullable().optional(),
  evidence_quote: z.string().min(1).nullable().optional(),
  verification: z.enum(['verified', 'inferred']),
  confidence: z.number().min(0).max(1),
});

const responseSchema = z.object({ requirements: z.array(z.unknown()).default([]) });

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function prepareEligibilitySources(
  sources: EligibilitySourceInput[]
): PreparedEligibilitySource[] {
  const seen = new Set<string>();
  return sources
    .map((source) => ({ ...source, contentText: source.contentText.trim() }))
    .filter((source) => source.contentText.length > 0)
    .map((source) => {
      if (seen.has(source.sourceKey)) {
        throw new Error(`Duplicate eligibility source key: ${source.sourceKey}`);
      }
      seen.add(source.sourceKey);
      return { ...source, contentSha256: sha256(source.contentText) };
    });
}

export function sourceFingerprint(sources: PreparedEligibilitySource[]): string {
  const canonical = [...sources]
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))
    .map((source) => `${source.sourceKey}:${source.contentSha256}`)
    .join('\n');
  return sha256(canonical);
}

/**
 * Validate the model output against stored source text. A claimed verified fact whose quote
 * cannot be found is retained for review, but deterministically downgraded to inferred.
 * Structurally invalid requirements are discarded.
 */
export function validateEligibilityRequirements(
  rawRequirements: unknown[],
  sources: PreparedEligibilitySource[]
): ValidatedEligibilityRequirement[] {
  const sourcesByKey = new Map(sources.map((source) => [source.sourceKey, source]));
  const validated: ValidatedEligibilityRequirement[] = [];

  for (const raw of rawRequirements) {
    const parsed = rawRequirementSchema.safeParse(raw);
    if (!parsed.success) continue;

    const item = parsed.data;
    const sourceKey = item.source_key ?? null;
    const quote = item.evidence_quote?.trim() ?? null;
    const source = sourceKey ? sourcesByKey.get(sourceKey) : undefined;
    const start = source && quote ? source.contentText.indexOf(quote) : -1;
    const evidenceIsValid = Boolean(source && quote && start >= 0);
    const verification = item.verification === 'verified' && evidenceIsValid
      ? 'verified'
      : 'inferred';

    // v3 precision guardrails: an exclusion must be explicitly stated, not manufactured by
    // negating a positive rule. Application instructions are not exclusion criteria.
    if (item.requirement_type === 'exclusion') {
      if (verification !== 'verified' || sourceKey === 'application') continue;
      if (!quote || !/(제외|불가|제한|금지|결격|해당하지 않|지원하지 않|신청할 수 없)/.test(quote)) continue;
    }

    validated.push({
      requirementType: item.requirement_type,
      operator: item.operator,
      value: item.value,
      // A verified user-facing claim must not be broader than its citation. Using the exact quote
      // makes that boundary deterministic; model-normalized language is retained only as inferred.
      normalizedText: verification === 'verified' && quote ? quote : item.normalized_text,
      sourceKey: source ? sourceKey : null,
      evidenceQuote: evidenceIsValid ? quote : null,
      evidenceStart: evidenceIsValid ? start : null,
      evidenceEnd: evidenceIsValid && quote ? start + quote.length : null,
      verification,
      confidence: item.confidence,
    });
  }

  return validated;
}

export interface EligibilityExtractionResult {
  extractorVersion: string;
  model: string;
  sourceFingerprint: string;
  requirements: ValidatedEligibilityRequirement[];
}

export async function extractEligibilityRequirements(
  sources: PreparedEligibilitySource[],
  generate: typeof generateText = generateText
): Promise<EligibilityExtractionResult> {
  const sourcePayload = sources.map((source) => ({
    source_key: source.sourceKey,
    title: source.title,
    text: source.contentText,
  }));
  const text = await generate({
    maxTokens: 1800,
    prompt: `정부지원사업의 신청 자격과 제외 조건만 추출하세요. 반드시 JSON만 응답하세요.

원칙:
- 원문에 없는 조건은 만들지 마세요.
- verified는 evidence_quote가 해당 source_key의 text에 글자 그대로 존재할 때만 사용하세요.
- evidence_quote 자체가 normalized_text의 전체 의미를 뒷받침해야 verified입니다. 인용보다
  지역·사업장·업종·기간 등의 의미를 넓히거나 바꾸는 정규화는 inferred로 표시하세요.
- 명시적 조건이지만 정규화에 해석이 필요한 경우 inferred로 표시하세요.
- confidence는 추출 확신도 0~1입니다. 신청자의 자격 확률이 아닙니다.
- confidence 1.0을 기본값처럼 쓰지 마세요. 원문 표현과 정규화가 사실상 동일하고
  문맥에 모호성이 전혀 없을 때만 1.0을 사용하세요.
- 홍보 문구, 지원 내용, 신청 절차는 자격 조건으로 추출하지 마세요.
- 신청서 제출, 접수, 평가, 신청기간, 첨부양식 같은 절차를 exclusion이나 자격으로
  추출하지 마세요.
- exclusion은 원문에 제외·불가·제한·금지·결격 등 부정 조건이 명시된 경우에만
  추출하세요. 긍정 조건(예: 중소기업, 7년 이내)을 반대로 바꾸어 별도 exclusion을
  만들지 마세요.
- verified의 normalized_text에 있는 모든 한정(지역, 주소 기준, 사업장 유형, 업종,
  기간, 접속사)은 evidence_quote가 직접 뒷받침해야 합니다. 일부만 인용되면 조건을
  각각 나누거나 inferred로 표시하세요.
- evidence_quote가 '중소기업'처럼 일반 분류만 말하면 주소·사업자등록증·지역 같은
  세부사항을 normalized_text에 덧붙이지 마세요.
- source_key가 target인 비어 있지 않은 지원 대상 문구는 최소 한 번 검토하고, 중소기업,
  소상공인, 법인 같은 명시적 대상 분류가 있으면 반드시 요구조건으로 추출하세요.

소스:
${JSON.stringify(sourcePayload)}

형식:
{
  "requirements": [{
    "requirement_type": ${JSON.stringify(REQUIREMENT_TYPES)} 중 하나,
    "operator": "eq" | "in" | "gte" | "lte" | "between" | "contains" | "excludes",
    "value": "정규화된 값, 배열 또는 {min,max,unit}",
    "normalized_text": "조건을 간결한 한국어로 표현",
    "source_key": "위 소스 키",
    "evidence_quote": "소스에 그대로 존재하는 짧은 인용문",
    "verification": "verified" | "inferred",
    "confidence": 0.0
  }]
}`,
  });

  const parsedJson = parseJsonResponse<unknown>(text);
  const parsedResponse = responseSchema.parse(parsedJson);
  if (parsedResponse.requirements.length === 0 && sources.some(
    (source) => source.sourceKey === 'target' && source.contentText.trim().length > 0
  )) {
    throw new Error('Extraction returned no requirements despite a non-empty target source');
  }
  return {
    extractorVersion: ELIGIBILITY_EXTRACTOR_VERSION,
    model: UPSTAGE_MODEL,
    sourceFingerprint: sourceFingerprint(sources),
    requirements: validateEligibilityRequirements(parsedResponse.requirements, sources),
  };
}
