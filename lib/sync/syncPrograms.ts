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

interface EnrichedData {
  ai_summary: string;
  ai_tags: string[];
  regions: string[];              // extracted 시/도 list, or ['전국']
  entity_types: string[];         // 법인 | 개인사업자 | 예비창업자 | 중소기업 | 창업벤처
  max_age_months: number | null;  // e.g. 84 for "창업 7년 이내"
  is_nationwide: boolean;
  apply_steps: string[];          // 신청 방법 원문을 단계별로 정리한 목록
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
    maxTokens: 700,
    prompt: `다음 정부지원사업 공고를 분석해서 JSON으로만 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

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
  "max_age_months": 업력 제한이 있으면 개월수로 (예: 창업 7년 이내 = 84, 3년 이내 = 36, 없으면 null),
  "apply_steps": ["신청방법 원문을 실행 가능한 단계별 목록으로 정리. 각 항목은 한 문장, 3~6단계 권장. 정보가 부족하면 원문을 그대로 한 단계로 넣기"]
}`,
  });

  try {
    const parsed = parseJsonResponse<{
      ai_summary?: string;
      ai_tags?: string[];
      entity_types?: string[];
      max_age_months?: number | null;
      apply_steps?: string[];
    }>(text);
    const regions = extractRegionsFromHashtags(item.hashtags);

    return {
      ai_summary: parsed.ai_summary ?? '',
      ai_tags: parsed.ai_tags ?? [],
      regions,
      entity_types: parsed.entity_types ?? [item.trgetNm],
      max_age_months: parsed.max_age_months ?? null,
      is_nationwide: regions[0] === '전국',
      apply_steps: parsed.apply_steps?.length ? parsed.apply_steps : cleanApplyMethod ? [cleanApplyMethod] : [],
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
      is_nationwide: false,
      apply_steps: cleanApplyMethod ? [cleanApplyMethod] : [],
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
    is_nationwide:  enriched.is_nationwide,
    apply_steps:    enriched.apply_steps,
    is_active:      true,
    updated_at:     new Date().toISOString(),
  };

  const { error } = await supabase
    .from('programs')
    .upsert(record, { onConflict: 'external_id' });

  if (error) {
    console.error(`  ❌ Supabase error for ${item.pblancId}:`, error.message);
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

  // Mark all existing programs inactive — we'll reactivate ones still in the API
  await supabase.from('programs').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');

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

  log(`✅ Done. Synced: ${synced}, Skipped (closed): ${skipped}`);
  return { synced, skipped };
}
