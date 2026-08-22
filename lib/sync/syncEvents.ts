// bizinfo Event API → Supabase sync — a sibling feed to syncPrograms.ts, on the
// same bizinfo.go.kr platform but a separate endpoint/key. Covers 세미나/전시회/
// 설명회/교육 등 business-support events, distinct from the funding/support
// announcements in `programs`.
//
// Required env vars:
//   BIZINFO_EVENT_API_KEY   — apply at https://www.bizinfo.go.kr/apiDetail.do?id=bizinfoEventApi
//                              (separate key from BIZINFO_API_KEY — different
//                              issuance, same portal/operator)
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// NOTE: written against the field names documented on the API's detail page
// (title, eventPeriod, areaNm, eventType, description, rceptPd, originOrg,
// originUrl, registDe, lcategory) and the response envelope shared by
// bizinfo's other APIs (response.body.items.item + totalCount) — the same
// shape pblancBsnsService (see syncPrograms.ts) uses. This hasn't been run
// against a live key yet: verify the item id field, exact date format, and
// response envelope against a real response on first run and adjust
// `ApiEventItem` / `fetchPage` if they differ.

import { createServiceClient } from '../supabase/server';
import { stripHtml } from '../utils';

const API_BASE = 'https://www.bizinfo.go.kr/uss/rss/bizinfoEventApi.do';
const PAGE_SIZE = 100;
// Safety cap independent of the API's reported totalCount — this sync hasn't
// been verified against a live response yet, so don't trust totalCount
// parsing alone to terminate the loop.
const MAX_PAGES = 50;

const ALL_REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const REGION_ALIASES: Record<string, string> = {
  '전남광주': '광주',
};

interface ApiEventItem {
  eventId: string;
  title: string;
  eventType: string;
  lcategory: string;
  originOrg: string;
  description: string;
  areaNm: string;
  eventPeriod: string;   // "YYYYMMDD~YYYYMMDD" (or possibly "YYYY-MM-DD ~ YYYY-MM-DD" — see file header)
  rceptPd: string;       // application period, same format as eventPeriod
  originUrl: string;
  registDe: string;
}

export interface SyncResult {
  synced: number;
  skipped: number;
}

/** Tolerates both "YYYYMMDD~YYYYMMDD" and "YYYY-MM-DD ~ YYYY-MM-DD" — format isn't confirmed yet. */
function parseDateRange(raw: string): { start: Date | null; end: Date | null } {
  if (!raw) return { start: null, end: null };

  const parts = raw.split('~').map((p) => p.trim());
  const toDate = (s: string | undefined): Date | null => {
    if (!s) return null;
    const normalized = /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  };

  return { start: toDate(parts[0]), end: toDate(parts[1]) };
}

/** Same 시/도-detection approach as syncPrograms.ts's hashtag parsing, applied to areaNm. */
function extractRegions(areaNm: string): string[] {
  if (!areaNm) return ['전국'];

  const tokens = areaNm.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
  const found: string[] = [];
  for (const token of tokens) {
    const normalized = REGION_ALIASES[token] ?? token;
    if (ALL_REGIONS.includes(normalized)) found.push(normalized);
  }

  if (found.length === 0) return ['전국'];
  if (found.length >= 13) return ['전국'];
  return Array.from(new Set(found));
}

async function upsertEvent(
  supabase: ReturnType<typeof createServiceClient>,
  item: ApiEventItem
): Promise<void> {
  const { start: eventStart, end: eventEnd } = parseDateRange(item.eventPeriod);
  const { start: applyStart, end: applyEnd } = parseDateRange(item.rceptPd);
  const regions = extractRegions(item.areaNm);

  const record = {
    external_id:  item.eventId,
    source:       'bizinfo',
    title:        item.title,
    event_type:   item.eventType || null,
    category:     item.lcategory || null,
    host_org:     item.originOrg || null,
    description:  stripHtml(item.description ?? ''),
    region:       regions,
    is_nationwide: regions[0] === '전국',
    event_start:  eventStart?.toISOString().split('T')[0] ?? null,
    event_end:    eventEnd?.toISOString().split('T')[0] ?? null,
    apply_start:  applyStart?.toISOString().split('T')[0] ?? null,
    apply_end:    applyEnd?.toISOString().split('T')[0] ?? null,
    detail_url:   item.originUrl || null,
    is_active:    true,
    updated_at:   new Date().toISOString(),
  };

  const { error } = await supabase
    .from('events')
    .upsert(record, { onConflict: 'external_id' });

  if (error) {
    console.error(`  ❌ Supabase error for event ${item.eventId}:`, error.message);
  }
}

async function fetchPage(pageNo: number): Promise<{ items: ApiEventItem[]; totalCount: number }> {
  const params = new URLSearchParams({
    crtfcKey:   process.env.BIZINFO_EVENT_API_KEY!,
    dataType:   'json',
    pageIndex:  String(pageNo),
    searchCnt:  String(PAGE_SIZE),
  });

  const res = await fetch(`${API_BASE}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const body = data.response?.body ?? data; // fall back to a flat envelope if bizinfo's own API differs from the data.go.kr gateway shape
  if (!body) throw new Error('Unexpected API response shape');

  const raw = body.items?.item ?? body.items ?? [];
  const items: ApiEventItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return { items, totalCount: Number(body.totalCount ?? items.length) };
}

/**
 * Full sync: fetch every event bizinfo currently lists, upsert into Supabase.
 * No AI enrichment — unlike syncPrograms.ts, the source data is already
 * structured (type/dates/region/host), so this stays fast and doesn't risk
 * the same timeout-vs-mass-deactivate failure mode.
 */
export async function syncEvents(log: (msg: string) => void = console.log): Promise<SyncResult> {
  const supabase = createServiceClient();

  log('🚀 Starting event sync...');

  // See syncPrograms.ts for why deactivation happens only after a full,
  // successful crawl rather than up front: an early mass-deactivate paired
  // with a mid-loop failure would wipe is_active for events the loop hadn't
  // reached yet.
  const syncStartedAt = new Date().toISOString();

  let pageNo = 1;
  let totalCount = Infinity;
  let synced = 0;
  let skipped = 0;

  while ((pageNo - 1) * PAGE_SIZE < totalCount && pageNo <= MAX_PAGES) {
    log(`📄 Fetching event page ${pageNo}...`);
    const { items, totalCount: total } = await fetchPage(pageNo);
    totalCount = total;

    log(`   ${items.length} items (${total} total)`);
    if (items.length === 0) break;

    for (const item of items) {
      const { end } = parseDateRange(item.eventPeriod);

      // Skip events that already ended
      if (end && end < new Date()) {
        skipped++;
        continue;
      }

      await upsertEvent(supabase, item);
      synced++;
    }

    pageNo++;
  }

  const { error: deactivateError } = await supabase
    .from('events')
    .update({ is_active: false })
    .eq('source', 'bizinfo')
    .lt('updated_at', syncStartedAt);

  if (deactivateError) {
    log(`⚠️  Failed to deactivate stale events: ${deactivateError.message}`);
  }

  log(`✅ Done. Synced: ${synced}, Skipped (ended): ${skipped}`);
  return { synced, skipped };
}
