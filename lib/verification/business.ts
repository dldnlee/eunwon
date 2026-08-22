// 국세청_사업자등록정보 진위확인 및 상태조회 서비스 (data.go.kr dataset id 15081808).
// Hosted on api.odcloud.kr, not the apis.data.go.kr GET+querystring pattern used
// by the bizinfo sync (lib/sync/syncPrograms.ts) — this one is POST+JSON.
//
// Scoped to the 상태조회 (status) op only: it's enough to confirm a 사업자등록번호
// is real and whether it's active/suspended/closed. The 진위확인 (validate) op's
// exact batch request shape wasn't confirmed against the live Swagger for this
// dataset, so it's deliberately left out — add it later if cross-checking
// 대표자성명/개업일자 becomes necessary.
//
// NTS_API_KEY must be the *decoded* data.go.kr key (matches the BIZINFO_API_KEY
// convention — see .env.local.example), auto-approved instantly, free.

const STATUS_URL = 'https://api.odcloud.kr/api/nts-businessman/v1/status';

export type BusinessStatus = 'active' | 'suspended' | 'closed' | 'not_found';

interface NtsStatusItem {
  b_no: string;
  b_stt_cd?: string;
  tax_type?: string;
  end_dt?: string;
}

interface NtsStatusResponse {
  data?: NtsStatusItem[];
}

export interface BusinessVerification {
  status: BusinessStatus;
  taxType: string | null;   // 과세유형, e.g. '부가가치세 일반과세자' — raw NTS text
  closedAt: string | null;  // 폐업일자 (yyyy-mm-dd), only set when status === 'closed'
}

const STATUS_CODE_MAP: Record<string, BusinessStatus> = {
  '01': 'active',
  '02': 'suspended',
  '03': 'closed',
};

/** Strip everything but digits — NTS expects a bare 10-digit number, no hyphens. */
function normalizeBusinessNumber(businessNumber: string): string {
  return businessNumber.replace(/\D/g, '');
}

/**
 * `business_status` in the DB only allows 'active'/'suspended'/'closed' (CHECK
 * constraint) — 'not_found' means "couldn't confirm," which is stored as null,
 * the same as never having verified at all.
 */
export function toDbBusinessStatus(status: BusinessStatus | null): 'active' | 'suspended' | 'closed' | null {
  return status === 'not_found' || status == null ? null : status;
}

/** NTS returns 폐업일자 as bare 'yyyymmdd' — reformat for a Postgres `date` column. */
function formatNtsDate(raw: string | undefined): string | null {
  if (!raw || raw.length !== 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/**
 * Looks up a single 사업자등록번호's status with the NTS API.
 * Returns status 'not_found' both when NTS has no record and on any request
 * failure — callers should treat this as "couldn't confirm," not as a hard
 * rejection, since newly-registered businesses can take 1-2 days to appear.
 */
export async function checkBusinessStatus(businessNumber: string): Promise<BusinessVerification> {
  const bNo = normalizeBusinessNumber(businessNumber);
  if (bNo.length !== 10) return { status: 'not_found', taxType: null, closedAt: null };

  const res = await fetch(`${STATUS_URL}?serviceKey=${process.env.NTS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ b_no: [bNo] }),
  });

  if (!res.ok) throw new Error(`NTS status lookup failed: HTTP ${res.status}`);

  const body = (await res.json()) as NtsStatusResponse;
  const item = body.data?.[0];
  if (!item) return { status: 'not_found', taxType: null, closedAt: null };

  const status = STATUS_CODE_MAP[item.b_stt_cd ?? ''] ?? 'not_found';
  return {
    status,
    taxType: item.tax_type ?? null,
    closedAt: status === 'closed' ? formatNtsDate(item.end_dt) : null,
  };
}
