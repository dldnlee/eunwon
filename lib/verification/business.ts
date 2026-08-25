// bizno.net free 사업자등록번호 조회 API — GET+querystring, XML or JSON.
// Swapped in for the NTS/data.go.kr status API (see git history) because that
// route requires a 위치기반서비스사업신고필증 attachment to activate, which is
// blocked on a DUNS we don't have yet. bizno's free tier needs no such filing:
// just sign up at bizno.net and generate a key from 마이페이지.
//
// Free tier: 200 requests/day, no batch endpoint (one 사업자등록번호 per call).
// Confirmed against the live "RESTful API" usage page bizno.net shows after
// key issuance (that page requires login, so this isn't independently public —
// re-verify here first if bizno ever changes their contract):
//   GET https://bizno.net/api/fapi
//     ?key=<BIZNO_API_KEY>      — required
//     &gb=1                     — required, search mode: 1=사업자등록번호 (exact match)
//     &q=<10-digit b_no>        — required, bare digits, no hyphens
//     &status=Y                 — get live 사업자상태/과세유형/폐업일, not just company/bno
//     &type=json                — default is xml
//   Response: { resultCode, resultMsg, totalCount, items: [{ company, bno, cno,
//     bsttcd, bstt, TaxTypeCd, taxtype, EndDt }] }. resultCode 0 = success.
//   NOTE: the docs' parameter table labels the status-code field "BStoCd", but
//   the live JSON example on the same page actually returns it as "bsttcd"
//   (lowercase) — trust the example over the table if this ever breaks.
//   bsttcd: '01' 계속사업자(active) / '02' 휴업자(suspended) / '03' 폐업자(closed).
//   EndDt is 폐업일 as bare 'YYYYMMDD', same shape the old NTS integration used.

const FAPI_URL = 'https://bizno.net/api/fapi';

export type BusinessStatus = 'active' | 'suspended' | 'closed' | 'not_found';

interface BiznoItem {
  bno: string;
  bsttcd?: string;
  taxtype?: string;
  EndDt?: string;
}

interface BiznoResponse {
  resultCode: number;
  resultMsg?: string;
  totalCount?: number;
  items?: BiznoItem[];
}

export interface BusinessVerification {
  status: BusinessStatus;
  taxType: string | null;   // 과세유형, e.g. '부가가치세 일반과세자' — raw bizno text
  closedAt: string | null;  // 폐업일자 (yyyy-mm-dd), only set when status === 'closed'
}

const STATUS_CODE_MAP: Record<string, BusinessStatus> = {
  '01': 'active',
  '02': 'suspended',
  '03': 'closed',
};

/** Strip everything but digits — bizno's `q` param expects a bare 10-digit number, no hyphens. */
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

/** bizno returns 폐업일자 as bare 'yyyymmdd' — reformat for a Postgres `date` column. */
function formatClosedDate(raw: string | undefined): string | null {
  if (!raw || raw.length !== 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/**
 * Looks up a single 사업자등록번호's status with the bizno free API.
 * Returns status 'not_found' both when bizno has no record and on any request
 * failure (missing key, quota exceeded, network error) — callers should treat
 * this as "couldn't confirm," not as a hard rejection, since newly-registered
 * businesses can take a few days to appear in any of these feeds.
 */
export async function checkBusinessStatus(businessNumber: string): Promise<BusinessVerification> {
  const bNo = normalizeBusinessNumber(businessNumber);
  if (bNo.length !== 10) return { status: 'not_found', taxType: null, closedAt: null };

  if (!process.env.BIZNO_API_KEY) return { status: 'not_found', taxType: null, closedAt: null };

  const params = new URLSearchParams({
    key: process.env.BIZNO_API_KEY,
    gb: '1',
    q: bNo,
    status: 'Y',
    type: 'json',
  });

  const res = await fetch(`${FAPI_URL}?${params}`);
  if (!res.ok) return { status: 'not_found', taxType: null, closedAt: null };

  const body = (await res.json()) as BiznoResponse;
  if (body.resultCode !== 0) return { status: 'not_found', taxType: null, closedAt: null };

  const item = body.items?.[0];
  if (!item) return { status: 'not_found', taxType: null, closedAt: null };

  const status = STATUS_CODE_MAP[item.bsttcd ?? ''] ?? 'not_found';
  return {
    status,
    taxType: item.taxtype || null,
    closedAt: status === 'closed' ? formatClosedDate(item.EndDt) : null,
  };
}
