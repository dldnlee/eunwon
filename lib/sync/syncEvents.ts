// Bizinfo Event API → Supabase sync. The source contract is locally fixture-tested, but must still
// be validated against a credentialed live response before production activation.

import { createServiceClient } from '../supabase/server';
import { crawlEventPages, normalizeBizinfoEvent, type RawBizinfoEvent } from '../events/importer';

const API_BASE = 'https://www.bizinfo.go.kr/uss/rss/bizinfoEventApi.do';
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export interface SyncResult { synced: number; skipped: number; runId: string }

async function fetchPage(pageNo: number): Promise<{ items: RawBizinfoEvent[]; totalCount: number }> {
  const key = process.env.BIZINFO_EVENT_API_KEY;
  if (!key) throw new Error('BIZINFO_EVENT_API_KEY is not configured');
  const params = new URLSearchParams({
    crtfcKey: key, dataType: 'json', pageIndex: String(pageNo), pageUnit: String(PAGE_SIZE),
    // Bizinfo documents searchCnt=0 as all matching rows; pageUnit/pageIndex perform pagination.
    searchCnt: '0',
  });
  const res = await fetch(`${API_BASE}?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Event API HTTP ${res.status}`);
  const data = await res.json();
  if (data.reqErr) throw new Error(`Event API rejected request: ${String(data.reqErr).slice(0, 300)}`);
  const body = data.response?.body ?? data;
  if (!body || typeof body !== 'object') throw new Error('Unexpected Event API response shape');
  const raw = data.jsonArray ?? body.items?.item ?? body.items ?? [];
  const items = (Array.isArray(raw) ? raw : raw ? [raw] : []) as RawBizinfoEvent[];
  const totalCount = Number(body.totalCount ?? items[0]?.totCnt ?? items.length);
  return { items, totalCount };
}

export async function syncEvents(log: (msg: string) => void = console.log): Promise<SyncResult> {
  const supabase = createServiceClient();
  const { data: run, error: runError } = await supabase
    .from('event_sync_runs').insert({ source: 'bizinfo', status: 'running' }).select('id').single();
  if (runError) throw new Error(`Failed to create event sync run: ${runError.message}`);

  const syncStartedAt = new Date().toISOString();
  let synced = 0;
  let skipped = 0;
  let itemsSeen = 0;
  let pagesFetched = 0;

  try {
    log(`🚀 Starting event sync (run ${run.id})...`);
    const items = await crawlEventPages(async (page) => {
      pagesFetched += 1;
      return fetchPage(page);
    }, PAGE_SIZE, MAX_PAGES);
    itemsSeen = items.length;

    for (const item of items) {
      let normalized;
      try {
        normalized = normalizeBizinfoEvent(item);
      } catch (error) {
        skipped += 1;
        log(`⚠️ Skipping malformed event: ${error instanceof Error ? error.message : 'unknown error'}`);
        continue;
      }
      const effectiveEnd = normalized.event_end ?? normalized.event_start;
      if (effectiveEnd && effectiveEnd < new Date().toISOString().slice(0, 10)) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase.from('events').upsert({
        ...normalized, is_active: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'external_id' });
      if (error) throw new Error(`Event ${normalized.external_id} persistence failed: ${error.message}`);
      synced += 1;
    }

    // Only a complete bounded crawl reaches deactivation. Truncation and caps throw above.
    const { error: deactivateError } = await supabase
      .from('events').update({ is_active: false }).eq('source', 'bizinfo').lt('updated_at', syncStartedAt);
    if (deactivateError) throw new Error(`Stale event deactivation failed: ${deactivateError.message}`);

    const { error: completionError } = await supabase.from('event_sync_runs').update({
      status: 'succeeded', pages_fetched: pagesFetched, items_seen: itemsSeen, items_synced: synced, items_skipped: skipped,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);
    if (completionError) throw new Error(`Event sync completion failed: ${completionError.message}`);
    return { synced, skipped, runId: run.id };
  } catch (error) {
    await supabase.from('event_sync_runs').update({
      status: 'failed', pages_fetched: pagesFetched, items_seen: itemsSeen, items_synced: synced, items_skipped: skipped,
      error_message: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown event sync error',
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);
    throw error;
  }
}
