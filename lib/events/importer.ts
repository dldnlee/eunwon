import { createHash } from 'node:crypto';
import { stripHtml } from '@/lib/utils';

export interface RawBizinfoEvent {
  eventInfoId?: string;
  eventId?: string;
  eventSn?: string;
  seq?: string;
  title?: string;
  nttNm?: string;
  eventInfoTyNm?: string;
  eventType?: string;
  lcategory?: string;
  originOrg?: string;
  originEngnNm?: string;
  description?: string;
  nttCn?: string;
  areaNm?: string;
  eventPeriod?: string;
  eventBeginEndDe?: string;
  rceptPd?: string;
  originUrl?: string;
  orginlUrlAdres?: string;
  bizinfoUrl?: string;
  registrationUrl?: string;
  location?: string;
  registDe?: string;
  updateDe?: string;
  updtPnttm?: string;
  onlineYn?: string;
  pldirSportRealmLclasCodeNm?: string;
  totCnt?: string | number;
}

export interface NormalizedEventImport {
  external_id: string;
  source: 'bizinfo';
  title: string;
  event_type: string | null;
  category: string | null;
  host_org: string | null;
  description: string;
  region: string[];
  is_nationwide: boolean;
  event_start: string | null;
  event_end: string | null;
  apply_start: string | null;
  apply_end: string | null;
  detail_url: string | null;
  registration_url: string | null;
  location_name: string | null;
  is_online: boolean;
  source_updated_at: string | null;
  content_sha256: string;
}

const ALL_REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];
const REGION_ALIASES: Record<string, string> = { 전남광주: '광주' };

export function parseEventDate(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const normalized = /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : normalized;
}

export function parseEventDateRange(raw: string | undefined): { start: string | null; end: string | null } {
  if (!raw) return { start: null, end: null };
  const parts = raw.split(/~|∼/).map((part) => part.trim());
  return { start: parseEventDate(parts[0]), end: parseEventDate(parts[1] ?? parts[0]) };
}

export function extractEventRegions(areaName: string | undefined): string[] {
  if (!areaName) return ['전국'];
  const found = ALL_REGIONS.filter((region) => {
    const source = Object.entries(REGION_ALIASES).reduce(
      (value, [alias, canonical]) => value.replaceAll(alias, canonical),
      areaName
    );
    return source.includes(region);
  });
  return found.length === 0 || found.length >= 13 ? ['전국'] : found;
}

function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeBizinfoEvent(raw: RawBizinfoEvent): NormalizedEventImport {
  const externalId = raw.eventInfoId ?? raw.eventId ?? raw.eventSn ?? raw.seq;
  if (!externalId?.trim()) throw new Error('Bizinfo event is missing a stable external id');
  const title = raw.nttNm ?? raw.title;
  if (!title?.trim()) throw new Error(`Bizinfo event ${externalId} is missing a title`);

  const event = parseEventDateRange(raw.eventBeginEndDe ?? raw.eventPeriod);
  const application = parseEventDateRange(raw.rceptPd);
  const description = stripHtml(raw.nttCn ?? raw.description ?? '');
  const regions = extractEventRegions(raw.areaNm);
  const searchableOnlineText = `${raw.onlineYn ?? ''} ${raw.location ?? ''} ${raw.areaNm ?? ''} ${description}`;
  const isOnline = /^(y|yes|true|1)$/i.test(raw.onlineYn?.trim() ?? '') || /온라인|비대면|웨비나/.test(searchableOnlineText);
  const canonical = JSON.stringify({
    externalId, title: title.trim(), type: raw.eventInfoTyNm ?? raw.eventType ?? '',
    category: raw.pldirSportRealmLclasCodeNm ?? raw.lcategory ?? '',
    organization: raw.originEngnNm ?? raw.originOrg ?? '', description, area: raw.areaNm ?? '', event, application,
    detail: raw.bizinfoUrl ?? raw.orginlUrlAdres ?? raw.originUrl ?? '',
    registration: raw.registrationUrl ?? raw.orginlUrlAdres ?? '', location: raw.location ?? '', isOnline,
  });

  return {
    external_id: externalId.trim(), source: 'bizinfo', title: title.trim(),
    event_type: (raw.eventInfoTyNm ?? raw.eventType)?.trim() || null,
    category: (raw.pldirSportRealmLclasCodeNm ?? raw.lcategory)?.trim() || null,
    host_org: (raw.originEngnNm ?? raw.originOrg)?.trim() || null, description, region: regions,
    is_nationwide: regions[0] === '전국', event_start: event.start, event_end: event.end,
    apply_start: application.start, apply_end: application.end,
    detail_url: safeHttpUrl(raw.bizinfoUrl) ?? safeHttpUrl(raw.orginlUrlAdres) ?? safeHttpUrl(raw.originUrl),
    registration_url: safeHttpUrl(raw.registrationUrl) ?? safeHttpUrl(raw.orginlUrlAdres) ?? safeHttpUrl(raw.bizinfoUrl),
    location_name: raw.location?.trim() || null, is_online: isOnline,
    source_updated_at: parseEventDate((raw.updtPnttm ?? raw.updateDe ?? raw.registDe)?.slice(0, 10)),
    content_sha256: createHash('sha256').update(canonical).digest('hex'),
  };
}

export interface EventPage<T> { items: T[]; totalCount: number }

/** Pure bounded crawl used by the live sync and deterministic tests. */
export async function crawlEventPages<T>(
  fetchPage: (page: number) => Promise<EventPage<T>>,
  pageSize = 100,
  maxPages = 50
): Promise<T[]> {
  const collected: T[] = [];
  let page = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while ((page - 1) * pageSize < totalCount) {
    if (page > maxPages) throw new Error(`Event crawl exceeded safety cap (${maxPages} pages)`);
    const result = await fetchPage(page);
    if (!Number.isFinite(result.totalCount) || result.totalCount < 0) {
      throw new Error('Event API returned an invalid totalCount');
    }
    totalCount = result.totalCount;
    if (result.items.length === 0 && collected.length < totalCount) {
      throw new Error('Event API ended before reported totalCount; refusing stale deactivation');
    }
    collected.push(...result.items);
    if (result.items.length === 0) break;
    page += 1;
  }

  return collected;
}
