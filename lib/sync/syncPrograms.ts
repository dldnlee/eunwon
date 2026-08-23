// Core bizinfo → Supabase sync logic, shared by scripts/sync-programs.ts
// (local/manual runs) and app/api/cron/sync-programs/route.ts (nightly Vercel Cron).
//
// Required env vars:
//   BIZINFO_API_KEY   — from data.go.kr (use decoded == not %3D%3D)
//   UPSTAGE_API_KEY   — from console.upstage.ai
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { generateText, parseJsonResponse } from '../ai/client';
import { createServiceClient } from '../supabase/server';
import { stripHtml } from '../utils';
import {
  ELIGIBILITY_EXTRACTOR_VERSION,
  extractEligibilityRequirements,
  prepareEligibilitySources,
  sourceFingerprint,
} from '../eligibility/extraction';
import { UPSTAGE_MODEL } from '../ai/client';

const API_BASE = 'https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService';
const PAGE_SIZE = 100;

// All 17 Korean 시/도 — used to detect nationwide programs
const ALL_REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

// hashtags use "전남광주" to mean 광주 — normalize it
const REGION_ALIASES: Record<string, string> = {
  '전남광주': '광주',
};

interface ApiItem {
  pblancNm: string;
  pblancUrl: string;
  pblancId: string;
  jrsdInsttNm: string;
  excInsttNm: string;
  bsnsSumryCn: string;
  pldirSportRealmLclasCodeNm: string;
  creatPnttm: string;
  reqstBeginEndDe: string;
  updtPnttm: string;
  trgetNm: string;
  hashtags: string;
  reqstMthPapersCn: string;
  refrncNm: string;
  rceptEngnHmpgUrl: string | null;
}

// Fixed vocabularies mirroring the exact option lists the onboarding form (components/OnboardingForm.tsx)
// offers users — the AI is constrained to these so a program's `required_*` fields can be compared
// directly against a profile's own fields (Array.includes / ===), instead of the old approach of
// hoping freeform `ai_tags` text happened to contain the right words.
const BUSINESS_TRAITS = ['B2B', 'B2C', 'B2G', '수출기업', '수출준비중', '채용 확대 예정'];
const TECH_DOMAINS = ['AI/소프트웨어', '바이오/헬스케어', '그린에너지/환경', '제조/하드웨어', '핀테크', '콘텐츠/미디어'];
const CERTIFICATIONS = ['벤처기업', '이노비즈', '메인비즈'];
const EXTRA_TAGS = ['여성기업', '장애인기업', '사회적기업', '재창업', '청년창업'];
const RND_CAPABILITY = ['기업부설연구소 보유', '전담부서 보유', '특허/지식재산권 보유'];
const INVESTMENT_STAGES = ['없음', '시드투자 유치', '시리즈A 이상 투자유치'];
const FUNDING_TYPES = ['보조금', '융자', '보증', '바우처', '세제지원', '기타'];

interface EnrichedData {
  ai_summary: string;
  ai_tags: string[];
  regions: string[];              // extracted 시/도 list, or ['전국']
  entity_types: string[];         // 법인 | 개인사업자 | 예비창업자 | 중소기업 | 창업벤처
  max_age_months: number | null;  // e.g. 84 for "창업 7년 이내"
  min_age_months: number | null;
  is_nationwide: boolean;
  apply_steps: string[];          // 신청 방법 원문을 단계별로 정리한 목록

  min_employees: number | null;
  max_employees: number | null;
  min_annual_revenue_krw: number | null;
  max_annual_revenue_krw: number | null;

  funding_amount_krw: number | null;
  funding_type: string | null;

  required_business_traits: string[];
  required_tech_domains: string[];
  required_certifications: string[];
  required_extra_tags: string[];
  required_rnd_capability: string[];
  required_investment_stage: string | null;
}

export interface SyncResult {
  synced: number;
  skipped: number;
}

/** Parse "2026-08-12 ~ 2026-08-31" → { start, end } as Date objects */
/**
 * Real bizinfo data isn't always a "YYYY-MM-DD ~ YYYY-MM-DD" range — many programs use
 * free text instead ("예산 소진시까지", "상시 접수", "세부사업별 상이", ...). Those parse to
 * an Invalid Date, which we collapse to null (treated as open-ended/상시 everywhere else
 * in the app) instead of throwing.
 */
function parseDeadline(reqstBeginEndDe: string): { start: Date | null; end: Date | null } {
  if (!reqstBeginEndDe) return { start: null, end: null };
  const parts = reqstBeginEndDe.split(' ~ ');
  const start = parts[0] ? new Date(parts[0].trim()) : null;
  const end = parts[1] ? new Date(parts[1].trim()) : null;
  return {
    start: start && !isNaN(start.getTime()) ? start : null,
    end: end && !isNaN(end.getTime()) ? end : null,
  };
}

/**
 * Extract regions from hashtags field.
 * hashtags like "서울,부산,대구,인천,전남광주,..." → check against ALL_REGIONS
 * If all 17 regions present → ['전국']
 */
function extractRegionsFromHashtags(hashtags: string): string[] {
  if (!hashtags) return ['전국'];

  const tags = hashtags.split(',').map((t) => t.trim());

  const found: string[] = [];
  for (const tag of tags) {
    const normalized = REGION_ALIASES[tag] ?? tag;
    if (ALL_REGIONS.includes(normalized)) {
      found.push(normalized);
    }
  }

  if (found.length === 0) return ['전국'];

  // If 13+ regions found, treat as nationwide
  if (found.length >= 13) return ['전국'];

  return Array.from(new Set(found));
}

async function enrichWithAI(item: ApiItem): Promise<EnrichedData> {
  const cleanDescription = stripHtml(item.bsnsSumryCn);
  const cleanApplyMethod = stripHtml(item.reqstMthPapersCn ?? '');

  const text = await generateText({
    maxTokens: 1200,
    prompt: `다음 정부지원사업 공고를 분석해서 JSON으로만 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요. 공고문에 명시적으로 언급되지 않은 조건은 추측하지 말고 null 또는 빈 배열로 두세요.

사업명: ${item.pblancNm}
주관기관: ${item.jrsdInsttNm}
지원대상: ${item.trgetNm}
내용: ${cleanDescription}
신청방법 원문: ${cleanApplyMethod}

다음 형식으로 응답:
{
  "ai_summary": "2문장으로 핵심만 요약. 누가 신청할 수 있고 무엇을 지원받는지 포함",
  "ai_tags": ["태그1", "태그2"] (내용이 융자, 대출, 보증, 이차보전 등 정책자금/대출성 지원이라면 분류상 카테고리와 무관하게 "대출" 태그를 반드시 포함),
  "entity_types": ["해당되는 것만 포함: 예비창업자, 개인사업자, 법인, 중소기업, 스타트업"],
  "max_age_months": 업력 상한이 있으면 개월수로 (예: 창업 7년 이내 = 84, 3년 이내 = 36, 없으면 null),
  "min_age_months": 업력 하한이 있으면 개월수로 (예: 설립 1년 이상 = 12, 없으면 null),
  "apply_steps": ["신청방법 원문을 실행 가능한 단계별 목록으로 정리. 각 항목은 한 문장, 3~6단계 권장. 정보가 부족하면 원문을 그대로 한 단계로 넣기"],
  "min_employees": 상시근로자 수 하한이 명시되어 있으면 숫자로, 없으면 null,
  "max_employees": 상시근로자 수 상한이 명시되어 있으면 숫자로 (예: "50인 미만" = 49, "10인 이하" = 10), 없으면 null,
  "min_annual_revenue_krw": 연매출 하한이 원 단위로 명시되어 있으면 숫자로, 없으면 null,
  "max_annual_revenue_krw": 연매출 상한이 원 단위로 명시되어 있으면 숫자로 (예: "연매출 10억원 이하" = 1000000000), 없으면 null,
  "funding_amount_krw": 1개 기업/과제당 지원하는 최대 금액이 원 단위로 명시되어 있으면 숫자로 (예: "최대 2천만원" = 20000000), 없으면 null,
  "funding_type": 다음 중 가장 가까운 것 하나만 선택 — "보조금" | "융자" | "보증" | "바우처" | "세제지원" | "기타", 지원 형태를 알 수 없으면 null,
  "required_business_traits": ["다음 중 지원대상으로 명시된 것만 포함, 없으면 빈 배열": ${JSON.stringify(BUSINESS_TRAITS)}],
  "required_tech_domains": ["다음 중 특정 기술분야로 한정하는 경우만 포함, 없으면 빈 배열": ${JSON.stringify(TECH_DOMAINS)}],
  "required_certifications": ["다음 중 필수 보유 인증으로 명시된 것만 포함, 없으면 빈 배열": ${JSON.stringify(CERTIFICATIONS)}],
  "required_extra_tags": ["다음 중 지원대상으로 한정하는 것만 포함, 없으면 빈 배열": ${JSON.stringify(EXTRA_TAGS)}],
  "required_rnd_capability": ["다음 중 필수 보유 역량으로 명시된 것만 포함, 없으면 빈 배열": ${JSON.stringify(RND_CAPABILITY)}],
  "required_investment_stage": 투자유치 단계 요건이 명시되어 있으면 다음 중 하나 — ${JSON.stringify(INVESTMENT_STAGES)}, 없으면 null
}`,
  });

  try {
    const parsed = parseJsonResponse<{
      ai_summary?: string;
      ai_tags?: string[];
      entity_types?: string[];
      max_age_months?: number | null;
      min_age_months?: number | null;
      apply_steps?: string[];
      min_employees?: number | null;
      max_employees?: number | null;
      min_annual_revenue_krw?: number | null;
      max_annual_revenue_krw?: number | null;
      funding_amount_krw?: number | null;
      funding_type?: string | null;
      required_business_traits?: string[];
      required_tech_domains?: string[];
      required_certifications?: string[];
      required_extra_tags?: string[];
      required_rnd_capability?: string[];
      required_investment_stage?: string | null;
    }>(text);
    const regions = extractRegionsFromHashtags(item.hashtags);

    // Defensively filter every controlled-vocabulary field down to its known option list —
    // the model is instructed to stick to these, but nothing stops a stray/hallucinated value
    // from slipping through, and an unrecognized value would just silently never match anything.
    const restrictTo = (values: string[] | undefined, allowed: string[]): string[] =>
      (values ?? []).filter((v) => allowed.includes(v));

    return {
      ai_summary: parsed.ai_summary ?? '',
      ai_tags: parsed.ai_tags ?? [],
      regions,
      entity_types: parsed.entity_types ?? [item.trgetNm],
      max_age_months: parsed.max_age_months ?? null,
      min_age_months: parsed.min_age_months ?? null,
      is_nationwide: regions[0] === '전국',
      apply_steps: parsed.apply_steps?.length ? parsed.apply_steps : cleanApplyMethod ? [cleanApplyMethod] : [],
      min_employees: parsed.min_employees ?? null,
      max_employees: parsed.max_employees ?? null,
      min_annual_revenue_krw: parsed.min_annual_revenue_krw ?? null,
      max_annual_revenue_krw: parsed.max_annual_revenue_krw ?? null,
      funding_amount_krw: parsed.funding_amount_krw ?? null,
      funding_type: FUNDING_TYPES.includes(parsed.funding_type ?? '') ? (parsed.funding_type as string) : null,
      required_business_traits: restrictTo(parsed.required_business_traits, BUSINESS_TRAITS),
      required_tech_domains: restrictTo(parsed.required_tech_domains, TECH_DOMAINS),
      required_certifications: restrictTo(parsed.required_certifications, CERTIFICATIONS),
      required_extra_tags: restrictTo(parsed.required_extra_tags, EXTRA_TAGS),
      required_rnd_capability: restrictTo(parsed.required_rnd_capability, RND_CAPABILITY),
      required_investment_stage: INVESTMENT_STAGES.includes(parsed.required_investment_stage ?? '')
        ? (parsed.required_investment_stage as string)
        : null,
    };
  } catch {
    // AI returned unparseable response — use safe fallback
    console.warn(`  ⚠️  AI parse failed for ${item.pblancId}, using fallback`);
    return {
      ai_summary: stripHtml(item.bsnsSumryCn).slice(0, 200),
      ai_tags: item.hashtags?.split(',').slice(0, 5) ?? [],
      regions: extractRegionsFromHashtags(item.hashtags),
      entity_types: [item.trgetNm],
      max_age_months: null,
      min_age_months: null,
      is_nationwide: false,
      apply_steps: cleanApplyMethod ? [cleanApplyMethod] : [],
      min_employees: null,
      max_employees: null,
      min_annual_revenue_krw: null,
      max_annual_revenue_krw: null,
      funding_amount_krw: null,
      funding_type: null,
      required_business_traits: [],
      required_tech_domains: [],
      required_certifications: [],
      required_extra_tags: [],
      required_rnd_capability: [],
      required_investment_stage: null,
    };
  }
}

async function upsertProgram(
  supabase: ReturnType<typeof createServiceClient>,
  item: ApiItem
): Promise<void> {
  const { start, end } = parseDeadline(item.reqstBeginEndDe);
  const enriched = await enrichWithAI(item);

  const record = {
    external_id:    item.pblancId,
    source:         'bizinfo',
    title:          item.pblancNm,
    agency:         item.jrsdInsttNm,
    exec_agency:    item.excInsttNm,
    category:       item.pldirSportRealmLclasCodeNm,  // 창업 | 수출 | 내수 | 기술 | 경영 등
    target_raw:     item.trgetNm,                     // 창업벤처 | 중소기업 | 소상공인 등
    description:    stripHtml(item.bsnsSumryCn),
    apply_method:   stripHtml(item.reqstMthPapersCn ?? ''),
    apply_url:      item.rceptEngnHmpgUrl ?? item.pblancUrl,
    detail_url:     item.pblancUrl,
    deadline_start: start?.toISOString().split('T')[0] ?? null,
    deadline_end:   end?.toISOString().split('T')[0] ?? null,
    hashtags_raw:   item.hashtags,
    // AI-enriched fields
    ai_summary:     enriched.ai_summary,
    ai_tags:        enriched.ai_tags,
    region:         enriched.regions,
    entity_types:   enriched.entity_types,
    max_age_months: enriched.max_age_months,
    min_age_months: enriched.min_age_months,
    is_nationwide:  enriched.is_nationwide,
    apply_steps:    enriched.apply_steps,

    min_employees:             enriched.min_employees,
    max_employees:             enriched.max_employees,
    min_annual_revenue_krw:    enriched.min_annual_revenue_krw,
    max_annual_revenue_krw:    enriched.max_annual_revenue_krw,
    funding_amount_krw:        enriched.funding_amount_krw,
    funding_type:              enriched.funding_type,
    required_business_traits:  enriched.required_business_traits,
    required_tech_domains:     enriched.required_tech_domains,
    required_certifications:   enriched.required_certifications,
    required_extra_tags:       enriched.required_extra_tags,
    required_rnd_capability:   enriched.required_rnd_capability,
    required_investment_stage: enriched.required_investment_stage,

    is_active:      true,
    updated_at:     new Date().toISOString(),
  };

  const { data: program, error } = await supabase
    .from('programs')
    .upsert(record, { onConflict: 'external_id' })
    .select('id')
    .single();

  if (error) {
    console.error(`  ❌ Supabase error for ${item.pblancId}:`, error.message);
    return;
  }

  try {
    await persistSourceBackedEligibility(supabase, program.id, item);
  } catch (eligibilityError) {
    // Eligibility provenance is additive. A failure must never roll back or erase the existing
    // program/enrichment fields, so the main sync can continue safely.
    console.warn(
      `  ⚠️  Eligibility extraction failed for ${item.pblancId}:`,
      eligibilityError instanceof Error ? eligibilityError.message : eligibilityError
    );
  }
}

async function persistSourceBackedEligibility(
  supabase: ReturnType<typeof createServiceClient>,
  programId: string,
  item: ApiItem
): Promise<void> {
  const sources = prepareEligibilitySources([
    {
      sourceKey: 'summary',
      sourceType: 'api_text',
      sourceUrl: item.pblancUrl,
      title: '사업 내용',
      contentText: stripHtml(item.bsnsSumryCn ?? ''),
    },
    {
      sourceKey: 'target',
      sourceType: 'api_text',
      sourceUrl: item.pblancUrl,
      title: '지원 대상',
      contentText: stripHtml(item.trgetNm ?? ''),
    },
    {
      sourceKey: 'application',
      sourceType: 'api_text',
      sourceUrl: item.pblancUrl,
      title: '신청 방법 및 서류',
      contentText: stripHtml(item.reqstMthPapersCn ?? ''),
    },
  ]);

  if (sources.length === 0) return;

  const { data: storedSources, error: sourceError } = await supabase
    .from('program_source_documents')
    .upsert(
      sources.map((source) => ({
        program_id: programId,
        source_key: source.sourceKey,
        source_type: source.sourceType,
        source_url: source.sourceUrl ?? null,
        title: source.title ?? null,
        content_text: source.contentText,
        content_sha256: source.contentSha256,
        extraction_status: 'extracted',
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'program_id,source_key' }
    )
    .select('id,source_key');
  if (sourceError) throw new Error(`source persistence failed: ${sourceError.message}`);

  const fingerprint = sourceFingerprint(sources);
  const { data: cachedRun, error: cacheError } = await supabase
    .from('program_extraction_runs')
    .select('id')
    .eq('program_id', programId)
    .eq('source_fingerprint', fingerprint)
    .eq('extractor_version', ELIGIBILITY_EXTRACTOR_VERSION)
    .eq('status', 'succeeded')
    .maybeSingle();
  if (cacheError) throw new Error(`extraction cache lookup failed: ${cacheError.message}`);
  if (cachedRun) return;

  const { data: run, error: runError } = await supabase
    .from('program_extraction_runs')
    .upsert({
      program_id: programId,
      source_fingerprint: fingerprint,
      extractor_version: ELIGIBILITY_EXTRACTOR_VERSION,
      model: UPSTAGE_MODEL,
      status: 'running',
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    }, { onConflict: 'program_id,source_fingerprint,extractor_version' })
    .select('id')
    .single();
  if (runError) throw new Error(`extraction run creation failed: ${runError.message}`);

  try {
    const extraction = await extractEligibilityRequirements(sources);
    const sourceIds = new Map(
      (storedSources ?? []).map((source: { id: string; source_key: string }) => [source.source_key, source.id])
    );

    const rows = extraction.requirements.map((requirement) => ({
      program_id: programId,
      extraction_run_id: run.id,
      source_document_id: requirement.sourceKey ? sourceIds.get(requirement.sourceKey) ?? null : null,
      requirement_type: requirement.requirementType,
      operator: requirement.operator,
      value_json: requirement.value,
      normalized_text: requirement.normalizedText,
      evidence_quote: requirement.evidenceQuote,
      evidence_start: requirement.evidenceStart,
      evidence_end: requirement.evidenceEnd,
      verification: requirement.verification,
      confidence: requirement.confidence,
    }));

    // A failed run is retried with the same unique run row. Clear any rows left by an earlier
    // partial attempt before inserting the newly validated result.
    const { error: clearError } = await supabase
      .from('program_eligibility_requirements')
      .delete()
      .eq('extraction_run_id', run.id);
    if (clearError) throw new Error(`previous requirement cleanup failed: ${clearError.message}`);

    if (rows.length > 0) {
      const { error: requirementError } = await supabase
        .from('program_eligibility_requirements')
        .insert(rows);
      if (requirementError) throw new Error(`requirement persistence failed: ${requirementError.message}`);
    }

    const { error: completionError } = await supabase
      .from('program_extraction_runs')
      .update({ status: 'succeeded', completed_at: new Date().toISOString() })
      .eq('id', run.id);
    if (completionError) throw new Error(`run completion failed: ${completionError.message}`);
  } catch (error) {
    await supabase
      .from('program_extraction_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown extraction error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);
    throw error;
  }
}

async function fetchPage(pageNo: number): Promise<{ items: ApiItem[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: process.env.BIZINFO_API_KEY!,
    dataType:   'json',
    pageNo:     String(pageNo),
    numOfRows:  String(PAGE_SIZE),
  });

  const res = await fetch(`${API_BASE}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const body = data.response?.body;
  if (!body) throw new Error('Unexpected API response shape');

  // API returns single object (not array) when only 1 result on a page
  const raw = body.items?.item;
  const items: ApiItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return { items, totalCount: Number(body.totalCount) };
}

/** Full nightly sync: fetch every active bizinfo program, enrich with AI, upsert into Supabase. */
export async function syncPrograms(log: (msg: string) => void = console.log): Promise<SyncResult> {
  const supabase = createServiceClient();

  log('🚀 Starting program sync...');

  // Every program upserted below gets updated_at bumped to "now" — so once every
  // page has synced successfully, anything with an *older* updated_at is a bizinfo
  // program that fell off the listing (closed/removed) and can be deactivated.
  //
  // We deliberately do NOT mark everything inactive up front. This job iterates
  // ~1,600 programs with an AI enrichment call each, which can easily exceed the
  // function's maxDuration — an early mass-deactivate paired with a timeout mid-loop
  // would silently wipe is_active for every program the loop hadn't reached yet.
  // Deactivating only at the end, and only if the full crawl completes, means a
  // timed-out run just leaves existing rows untouched instead of blanking them.
  const syncStartedAt = new Date().toISOString();

  let pageNo = 1;
  let totalCount = Infinity;
  let synced = 0;
  let skipped = 0;

  while ((pageNo - 1) * PAGE_SIZE < totalCount) {
    log(`📄 Fetching page ${pageNo}...`);
    const { items, totalCount: total } = await fetchPage(pageNo);
    totalCount = total;

    log(`   ${items.length} items (${total} total)`);

    for (const item of items) {
      const { end } = parseDeadline(item.reqstBeginEndDe);

      // Skip programs that already closed
      if (end && end < new Date()) {
        skipped++;
        continue;
      }

      await upsertProgram(supabase, item);
      synced++;

      // Small delay to avoid hammering the AI API
      await new Promise((r) => setTimeout(r, 200));
    }

    pageNo++;
  }

  // Only reached if every page synced without throwing — safe to deactivate
  // whatever bizinfo no longer lists.
  const { error: deactivateError } = await supabase
    .from('programs')
    .update({ is_active: false })
    .eq('source', 'bizinfo')
    .lt('updated_at', syncStartedAt);

  if (deactivateError) {
    log(`⚠️  Failed to deactivate stale programs: ${deactivateError.message}`);
  }

  log(`✅ Done. Synced: ${synced}, Skipped (closed): ${skipped}`);
  return { synced, skipped };
}
