# Eunwon AI — Master Build Plan
### eunwon.com

---

## What This Is

Eunwon AI is a Korean SaaS product that helps 소상공인, 스타트업, and 중소기업 owners find and apply for 정부지원사업 (government support programs). It matches each user's specific business profile against a live database of ~1,500+ programs sourced from 기업마당 (bizinfo.go.kr), and goes beyond simple search by generating tailored application documents, tracking deadlines proactively, and preventing wasted time on programs the user doesn't qualify for.

**The founding insight:** The name Eunwon (은원) is the Korean name of the founder. 은 means silver, 원 means circle. It's personal, unique as a domain, and has zero trademark conflict.

**Why this is more than a data wrapper:** Any LLM can answer "what 정부지원사업 exist." What an LLM cannot do is tell a specific 3-year-old Seoul software company exactly which of the 1,500 programs they legally qualify for right now, alert them 3 days before a relevant deadline closes, or draft a 사업계획서 using their actual revenue numbers and story. That's the product.

**Target users:** 소상공인, 스타트업, 중소기업 owners. Eventually: 세무사/컨설턴트 firms managing multiple clients.

**Business model:** Freemium via 토스페이먼츠.
- Free: 5 matched programs/day, no AI explanation, no document generation
- Pro (₩39,000/month): unlimited matches, AI explanations, 사업계획서 generation, deadline alerts, duplicate benefit tracking, document vault

**Current status:** API key approved ✅ — API live, returning 1,573 active programs ✅ — Service working ✅

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend + API | Next.js 14 (App Router) | Familiar; SSR + API routes in one project |
| Database + Auth | Supabase | Postgres + built-in auth + Storage + Edge Functions |
| AI | Upstage Solar Pro 4 via Vercel AI SDK | Korean AI company, strong Korean language quality, OpenAI-compatible |
| Payments | 토스페이먼츠 | Standard for Korean products, good Next.js SDK |
| Email | Resend | Free tier covers early growth (3,000 emails/month) |
| Deployment | Vercel | Zero-config Next.js, built-in cron |
| Styling | Tailwind CSS + shadcn/ui | Fast to build clean UI |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Vercel (Next.js)                          │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │   App Pages     │  │   API Routes     │  │   Cron Jobs    │  │
│  │   /             │  │   /match         │  │   sync-programs│  │
│  │   /onboard      │  │   /generate      │  │   notify-users │  │
│  │   /dashboard    │  │   /profile       │  │   charge-subs  │  │
│  │   /program/[id] │  │   /ai/explain    │  │                │  │
│  │   /saved        │  │   /ai/draft      │  │                │  │
│  │   /settings/    │  │   /payments/     │  │                │  │
│  └─────────────────┘  └──────────────────┘  └────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
          ┌────────────────────┼─────────────────┬──────────────┐
          │                    │                 │              │
  ┌───────▼──────┐  ┌──────────▼──────┐  ┌──────▼──────┐ ┌────▼──────────┐
  │  Supabase    │  │  Upstage        │  │   Resend    │ │  기업마당 API  │
  │  Postgres    │  │  Solar Pro 4    │  │   (email)   │ │  (nightly sync)│
  │  Auth        │  │  (AI summary,   │  │             │ │  1,500+ programs│
  │  Storage     │  │   doc gen,      │  │             │ │                │
  │  (doc vault) │  │   explain)      │  │             │ │                │
  └──────────────┘  └─────────────────┘  └─────────────┘ └────────────────┘
```

---

## Data Source

### 기업마당 API (confirmed working)

**Endpoint:**
```
GET https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService
  ?serviceKey=YOUR_KEY
  &dataType=json
  &pageNo=1
  &numOfRows=100
```

Key: obtained from data.go.kr (use decoded `==`, not `%3D%3D`). Auto-approved on application.

**Response fields:**

| Field | Description | Example |
|---|---|---|
| `pblancId` | Unique program ID | `PBLN_000000000125549` |
| `pblancNm` | Program title | `2026년 제조전문형 메이커스페이스...` |
| `pblancUrl` | Detail page URL | `https://www.bizinfo.go.kr/...` |
| `jrsdInsttNm` | 주관기관 | `중소벤처기업부`, `부산광역시` |
| `excInsttNm` | 실행기관 | `전남대학교`, `부산창조경제혁신센터` |
| `bsnsSumryCn` | Program description **(HTML)** | Raw HTML — must strip before use |
| `pldirSportRealmLclasCodeNm` | Category | `창업`, `수출`, `내수`, `기술`, `경영` |
| `trgetNm` | Target (broad) | `창업벤처`, `중소기업`, `소상공인` |
| `reqstBeginEndDe` | Application period | `2026-08-12 ~ 2026-08-31` |
| `hashtags` | Tags incl. regions | `창업,서울,부산,경기,예비창업자,...` |
| `reqstMthPapersCn` | How to apply | `이메일 접수 (info@...)` |
| `rceptEngnHmpgUrl` | Online apply URL (nullable) | `https://pms.dicia.or.kr/...` |
| `refrncNm` | Contact info | `담당자 062-530-5059` |

**Key insights from real data:**
- Region is embedded in `hashtags` as comma-separated 시/도 names — no AI needed for extraction
- 13+ regions in hashtags = treat as 전국
- Eligibility criteria (업력, 직원수) are in free-text `bsnsSumryCn` — Solar Pro 4 extracts these at sync time

---

## Full Database Schema

```sql
-- ─── Programs (populated by sync script) ─────────────────────────────────────

create table programs (
  id              uuid primary key default gen_random_uuid(),

  -- Direct from API
  external_id     text unique not null,       -- pblancId
  source          text not null default 'bizinfo',
  title           text not null,              -- pblancNm
  agency          text not null,              -- jrsdInsttNm (주관기관)
  exec_agency     text,                       -- excInsttNm (실행기관)
  category        text,                       -- 창업|수출|내수|기술|경영
  target_raw      text,                       -- trgetNm: 창업벤처|중소기업|소상공인
  description     text,                       -- bsnsSumryCn (HTML stripped)
  apply_method    text,                       -- reqstMthPapersCn
  apply_url       text,                       -- rceptEngnHmpgUrl or pblancUrl
  detail_url      text,                       -- pblancUrl
  deadline_start  date,
  deadline_end    date,
  hashtags_raw    text,

  -- AI-enriched fields (Solar Pro 4 at sync time)
  ai_summary      text,                       -- 2-sentence plain Korean summary
  ai_tags         text[],
  region          text[],                     -- ['전국'] or ['서울', '경기']
  entity_types    text[],                     -- ['예비창업자', '법인', '중소기업']
  max_age_months  int,                        -- e.g. 84 for "창업 7년 이내"
  is_nationwide   boolean default false,

  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on programs (deadline_end, is_active);
create index on programs using gin (region);
create index on programs using gin (entity_types);
create index on programs using gin (ai_tags);

-- ─── Profiles (company info — drives all matching) ───────────────────────────

create table profiles (
  id                  uuid primary key references auth.users(id),
  -- Basic identity
  company_name        text,
  representative_name text,
  business_number     text,                   -- 사업자등록번호
  -- Classification
  entity_type         text not null,          -- 예비창업자 | 개인사업자 | 법인
  industry_code       text,                   -- KSIC 5-digit
  industry_name       text,                   -- e.g. IT서비스, 제조업
  tech_domains        text[],                 -- ['AI', '바이오', '제조']
  -- Eligibility fields
  founded_at          date,
  age_months          integer generated always as (
    extract(year  from age(current_date, founded_at)) * 12 +
    extract(month from age(current_date, founded_at))
  ) stored,
  region              text not null,          -- 시/도
  employee_count      integer,
  annual_revenue_krw  bigint,                 -- 원
  -- Enrichment
  certifications      text[],                 -- ['벤처기업', '이노비즈', '메인비즈']
  extra_tags          text[],                 -- ['여성기업', '장애인기업']
  current_challenges  text,                   -- free-text fed to AI matcher
  -- Account
  subscription        text default 'free',    -- free | pro
  notify_email        boolean default true,
  onboarding_complete boolean default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── Saved Programs + Application Tracking ───────────────────────────────────

create table saved_programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  program_id  uuid references programs not null,
  status      text default 'saved',           -- saved | applied | selected | rejected
  outcome     text,                           -- for 중복수혜 tracking
  received_at date,
  amount_krw  integer,                        -- amount received if selected
  notes       text,
  created_at  timestamptz default now(),
  unique(user_id, program_id)
);

-- ─── Notification Log (deduplication) ────────────────────────────────────────

create table notification_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  program_id  uuid references programs not null,
  type        text not null,                  -- new_match | deadline_7d | deadline_3d | deadline_1d
  sent_at     timestamptz default now()
);

-- ─── Document Vault ───────────────────────────────────────────────────────────

create table user_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  type          text not null,               -- bizreg | financial | resume | past_application
  filename      text not null,
  storage_path  text not null,              -- Supabase Storage path
  year          integer,                    -- for financial statements
  created_at    timestamptz default now()
);
```

---

## Data Pipeline

### Sync Job

Runs nightly at 02:00 KST via Vercel Cron (`0 17 * * *` UTC):

1. Mark all existing programs `is_active = false`
2. Fetch all pages from 기업마당 API (100/page, ~16 pages, ~1,500 programs)
3. For each program: skip if `deadline_end` already passed — no AI call, saves cost
4. For each active program: strip HTML, extract regions from hashtags, call Solar Pro 4 for `ai_summary` / `entity_types` / `max_age_months`
5. Upsert to Supabase — new programs inserted, existing ones updated
6. Programs not seen in this sync remain `is_active = false` (they closed)

### Sync Script (`scripts/sync-programs.ts`)

Run locally to seed the database for the first time.

```bash
# Install deps (in your Next.js project root)
npm install @supabase/supabase-js ai @ai-sdk/openai-compatible
npm install -D tsx dotenv

# First run (~15 min, populates all ~1,500 programs)
npx tsx scripts/sync-programs.ts
```

```typescript
// scripts/sync-programs.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const upstage = createOpenAICompatible({
  name: 'upstage',
  baseURL: 'https://api.upstage.ai/v1',
  apiKey: process.env.UPSTAGE_API_KEY!,
});
const model = upstage('solar-pro');

const API_BASE = 'https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService';
const PAGE_SIZE = 100;

const ALL_REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];
const REGION_ALIASES: Record<string, string> = { '전남광주': '광주' };

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDeadline(s: string) {
  if (!s) return { start: null, end: null };
  const [a, b] = s.split(' ~ ');
  return { start: a ? new Date(a.trim()) : null, end: b ? new Date(b.trim()) : null };
}

function extractRegions(hashtags: string): string[] {
  if (!hashtags) return ['전국'];
  const tags = hashtags.split(',').map(t => t.trim());
  const found: string[] = [];
  for (const tag of tags) {
    const n = REGION_ALIASES[tag] ?? tag;
    if (ALL_REGIONS.includes(n)) found.push(n);
  }
  if (found.length === 0 || found.length >= 13) return ['전국'];
  return [...new Set(found)];
}

async function enrichWithAI(item: any) {
  const clean = stripHtml(item.bsnsSumryCn ?? '');
  const { text } = await generateText({
    model,
    maxTokens: 600,
    prompt: `다음 정부지원사업 공고를 분석해서 JSON으로만 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

사업명: ${item.pblancNm}
주관기관: ${item.jrsdInsttNm}
지원대상: ${item.trgetNm}
내용: ${clean}

다음 형식으로 응답:
{
  "ai_summary": "2문장으로 핵심 요약. 누가 신청 가능하고 무엇을 지원받는지 포함",
  "ai_tags": ["태그1", "태그2"],
  "entity_types": ["해당하는 것만: 예비창업자, 개인사업자, 법인, 중소기업, 스타트업, 소상공인"],
  "max_age_months": 업력제한 개월수 또는 null
}`,
  });

  try {
    const p = JSON.parse(text.trim());
    const regions = extractRegions(item.hashtags);
    return {
      ai_summary: p.ai_summary ?? clean.slice(0, 200),
      ai_tags: p.ai_tags ?? [],
      region: regions,
      entity_types: p.entity_types ?? [item.trgetNm],
      max_age_months: p.max_age_months ?? null,
      is_nationwide: regions[0] === '전국',
    };
  } catch {
    console.warn(`  ⚠️  AI parse failed for ${item.pblancId}, using fallback`);
    const regions = extractRegions(item.hashtags);
    return {
      ai_summary: clean.slice(0, 200),
      ai_tags: item.hashtags?.split(',').slice(0, 5) ?? [],
      region: regions,
      entity_types: [item.trgetNm],
      max_age_months: null,
      is_nationwide: regions[0] === '전국',
    };
  }
}

async function upsertProgram(item: any) {
  const { start, end } = parseDeadline(item.reqstBeginEndDe);
  const enriched = await enrichWithAI(item);

  const { error } = await supabase.from('programs').upsert({
    external_id:    item.pblancId,
    source:         'bizinfo',
    title:          item.pblancNm,
    agency:         item.jrsdInsttNm,
    exec_agency:    item.excInsttNm,
    category:       item.pldirSportRealmLclasCodeNm,
    target_raw:     item.trgetNm,
    description:    stripHtml(item.bsnsSumryCn ?? ''),
    apply_method:   item.reqstMthPapersCn,
    apply_url:      item.rceptEngnHmpgUrl ?? item.pblancUrl,
    detail_url:     item.pblancUrl,
    deadline_start: start?.toISOString().split('T')[0] ?? null,
    deadline_end:   end?.toISOString().split('T')[0] ?? null,
    hashtags_raw:   item.hashtags,
    ...enriched,
    is_active:      true,
    updated_at:     new Date().toISOString(),
  }, { onConflict: 'external_id' });

  if (error) console.error(`  ❌ ${item.pblancId}:`, error.message);
}

async function fetchPage(pageNo: number) {
  const params = new URLSearchParams({
    serviceKey: process.env.BIZINFO_API_KEY!,
    dataType: 'json',
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
  });
  const res = await fetch(`${API_BASE}?${params}`);
  const data = await res.json();
  const body = data.response?.body;
  const raw = body?.items?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return { items, totalCount: Number(body?.totalCount ?? 0) };
}

async function main() {
  console.log('🚀 Starting sync...');
  await supabase.from('programs')
    .update({ is_active: false })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  let pageNo = 1, totalCount = Infinity, synced = 0, skipped = 0;

  while ((pageNo - 1) * PAGE_SIZE < totalCount) {
    console.log(`\n📄 Page ${pageNo}...`);
    const { items, totalCount: total } = await fetchPage(pageNo);
    totalCount = total;
    console.log(`   ${items.length} items (${total} total)`);

    for (const item of items) {
      const { end } = parseDeadline(item.reqstBeginEndDe);
      if (end && end < new Date()) { skipped++; continue; }
      process.stdout.write(`  ↳ ${item.pblancNm.slice(0, 50)}...`);
      await upsertProgram(item);
      process.stdout.write(' ✓\n');
      synced++;
      await new Promise(r => setTimeout(r, 200));
    }
    pageNo++;
  }
  console.log(`\n✅ Done. Synced: ${synced}, Skipped (closed): ${skipped}`);
}

main().catch(console.error);
```

---

## AI Integration (Upstage Solar Pro 4)

Solar Pro 4 is used in three places: sync-time enrichment, runtime match explanation, and 사업계획서 generation.

```typescript
// lib/ai/client.ts — shared across all AI features
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const upstage = createOpenAICompatible({
  name: 'upstage',
  baseURL: 'https://api.upstage.ai/v1',
  apiKey: process.env.UPSTAGE_API_KEY!,
});

export const model = upstage('solar-pro'); // verify exact ID at developers.upstage.ai
```

### Match Explanation (Pro)

```typescript
// lib/ai/explainMatch.ts
export async function explainMatch(program: any, profile: any) {
  const { text } = await generateText({
    model,
    maxTokens: 200,
    prompt: `사용자의 사업과 지원사업의 매칭 이유를 1-2문장으로 설명해주세요.

사용자: 업종 ${profile.industry_name}, 지역 ${profile.region}, 업력 ${profile.age_months}개월,
직원 ${profile.employee_count}명, ${profile.entity_type}

지원사업: ${program.title}
요약: ${program.ai_summary}

왜 이 사업이 이 사용자에게 적합한지 구체적으로, 친근한 한국어로 작성하세요.`,
  });
  return text;
}
```

### 사업계획서 Generation (Pro)

```typescript
// app/api/generate-document/route.ts
export async function POST(req: Request) {
  const { programId, userId } = await req.json();

  const [{ data: program }, { data: profile }] = await Promise.all([
    supabase.from('programs').select('*').eq('id', programId).single(),
    supabase.from('profiles').select('*').eq('id', userId).single(),
  ]);

  const { text } = await generateText({
    model,
    maxTokens: 2000,
    prompt: `다음 정보를 바탕으로 정부지원사업 신청서를 작성해주세요.

[기업 정보]
- 업종: ${profile.industry_name}
- 창업일: ${profile.founded_at} (업력 ${profile.age_months}개월)
- 소재지: ${profile.region}
- 종업원 수: ${profile.employee_count}명
- 연매출: ${(profile.annual_revenue_krw / 100000000).toFixed(1)}억원
- 현재 과제: ${profile.current_challenges}

[지원사업 정보]
- 사업명: ${program.title}
- 주관기관: ${program.agency}
- 지원 내용: ${program.description}

형식: 사업 개요 → 신청 배경 → 추진 계획 → 기대 효과
실제 신청서에 바로 붙여넣을 수 있는 수준으로 작성해주세요.`,
  });

  return Response.json({ document: text });
}
```

---

## Matching Logic

Pure SQL — no AI at query time. Fast and cheap.

```typescript
// lib/matching.ts
export async function getMatchedPrograms(profile: any) {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .gte('deadline_end', today)
    .or(`is_nationwide.eq.true,region.cs.{"${profile.region}"}`)
    .or(`max_age_months.is.null,max_age_months.gte.${profile.age_months}`)
    .contains('entity_types', [profile.entity_type])
    .order('deadline_end', { ascending: true })
    .limit(50);

  return data ?? [];
}
```

**Eligibility filters applied:**
- `deadline_end` not yet passed
- Region is 전국 OR matches user's 시/도
- `max_age_months` is null (no restriction) OR user's age is within it
- `entity_types` includes user's entity type (개인사업자, 법인, 예비창업자)

---

## What Makes the Service Irreplaceable

The five features that go beyond what any LLM can do alone:

### 1. Deep Company Profiling → Real Eligibility Filtering

Every field in `profiles` maps directly to a filtering criterion. A user sees only programs they actually qualify for — not a general list. A 2-year-old Seoul software company sees a completely different set than a 10-year-old Busan manufacturer.

**Eligibility fields that matter most:**

| Field | Programs it filters |
|---|---|
| `age_months` | Most programs cap 업력 at 3, 5, or 7 years |
| `region` | Regional programs (시/도-specific agencies) |
| `entity_type` | 예비창업자 vs 법인 often have entirely separate program pools |
| `employee_count` | 소기업/중기업 thresholds |
| `certifications` | 벤처기업 certification unlocks additional programs |

### 2. 사업계획서 Generation

Writing these documents is the biggest barrier to actually applying. Each program has a different required format and evaluation focus. Eunwon AI has the user's real profile and the program's requirements — and drafts the document accordingly. This is the Pro tier anchor.

### 3. Deadline Tracking & Proactive Alerts

Daily cron at 09:00 KST sends email alerts:
- "귀사에 맞는 새 지원사업이 열렸습니다 — 마감 5일 전"
- 7-day, 3-day, 1-day warnings for saved programs

Users get value even when they're not actively using the app.

### 4. 중복수혜 제한 Tracking

Korean programs frequently bar companies that already received similar support. Users mark outcomes (선정됨/탈락) in their saved programs. The system flags future programs that may conflict: "⚠️ 이미 수혜받은 사업과 중복될 수 있습니다." Prevents wasted applications and builds trust.

### 5. Document Vault & Autofill

Users upload their 사업자등록증, 재무제표, and past 사업계획서 once. These feed into future document generation as context, and common fields (registration number, revenue, employee count) never need to be re-entered.

---

## Freemium Model

| Feature | Free | Pro (₩39,000/월) | Pro+ (₩89,000/월 — future) |
|---|---|---|---|
| Matched programs | 5/day | Unlimited | Unlimited |
| AI match explanation | ✗ | ✓ | ✓ |
| Eligibility filtering | Basic | Full | Full |
| 사업계획서 generation | ✗ | 5/month | Unlimited |
| Deadline alerts (email) | ✗ | ✓ | ✓ + KakaoTalk |
| 중복수혜 tracking | ✗ | ✓ | ✓ |
| Document vault | ✗ | 5 files | Unlimited |
| Saved programs | 3 | Unlimited | Unlimited |
| Multi-company management | ✗ | ✗ | Up to 5 |
| Consultant dashboard | ✗ | ✗ | ✓ |

---

## Frontend Pages

```
/                         Landing page
/login, /signup           Auth
/onboard                  Multi-step company profile wizard (required for new users)
/dashboard                Matched programs, ranked by deadline, filtered by profile
/dashboard/saved          Kanban: 저장됨 → 신청함 → 결과대기 → 완료
/program/[id]             Full program detail, eligibility check, "신청하기" button
/program/[id]/generate    사업계획서 generation UI (Pro)
/settings/profile         Edit company profile
/settings/documents       Document vault — upload 사업자등록증, 재무제표, etc.
/settings/notifications   Alert preferences
/settings/billing         Subscription management
```

### Onboarding Wizard (`/onboard`) — 4 steps

1. **사업 형태** — 예비창업자 | 개인사업자 | 법인
2. **업종 + 지역** — industry text input + 시/도 dropdown
3. **규모** — 창업일 (date picker), 직원수, 연매출
4. **추가 정보** — certifications, current challenges (free text)

All fields save to `profiles`. Gate dashboard behind onboarding completion for new users.

### Dashboard Card Design

Each program card shows:
- Title + agency
- Deadline badge: 🔴 D-7 이내 | 🟡 D-30 이내 | 회색 otherwise
- `ai_summary` (2 sentences)
- "왜 나에게 맞나요?" button (Pro only — calls `/api/ai/explain`)
- Bookmark icon → saves to `saved_programs`
- Match score indicator (% of eligibility criteria met)

---

## Authentication

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });
  const { data: { session } } = await supabase.auth.getSession();

  const protected_ = ['/dashboard', '/saved', '/program', '/settings', '/onboard'];
  if (!session && protected_.some(p => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return res;
}
```

---

## Payments (토스페이먼츠)

**Subscription flow:**
1. User clicks "Pro로 업그레이드"
2. Redirect to 토스페이먼츠 결제창 (빌링키 발급)
3. On success: store `billingKey`, update `profiles.subscription = 'pro'`
4. Monthly Vercel Cron charges billing keys
5. On payment failure: downgrade to free tier

**Pro gate (server-side):**
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('subscription')
  .eq('id', userId)
  .single();

if (profile?.subscription !== 'pro') {
  return Response.json({ error: 'Pro 플랜이 필요합니다' }, { status: 403 });
}
```

---

## Notification System

Two cron jobs, both via Vercel Cron:

**1. Sync (`0 17 * * *` = 02:00 KST):** Pulls fresh programs from 기업마당 API, enriches with AI, upserts to DB.

**2. Notify (`0 0 * * *` = 09:00 KST):** For each Pro user with `notify_email = true`:
- Run matching query for their profile
- Check `notification_log` for what's already been sent
- Send deadline warnings (7d, 3d, 1d) for saved programs
- Send "new match" emails for programs added since last notify run
- Insert into `notification_log` to prevent duplicates

```typescript
// Resend email
await resend.emails.send({
  from: 'Eunwon AI <alerts@eunwon.com>',
  to: user.email,
  subject: `[마감 ${daysLeft}일] ${program.title}`,
  html: buildDeadlineEmail(program, profile, daysLeft),
});
```

---

## Project Structure

```
/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx               ← matched programs
│   │   │   └── saved/page.tsx         ← application tracker
│   │   ├── program/[id]/
│   │   │   ├── page.tsx
│   │   │   └── generate/page.tsx      ← 사업계획서 generation
│   │   └── settings/
│   │       ├── profile/page.tsx
│   │       ├── documents/page.tsx
│   │       ├── notifications/page.tsx
│   │       └── billing/page.tsx
│   ├── onboard/page.tsx
│   ├── api/
│   │   ├── cron/
│   │   │   ├── sync-programs/route.ts
│   │   │   └── notify-users/route.ts
│   │   ├── ai/
│   │   │   ├── explain/route.ts
│   │   │   └── generate-document/route.ts
│   │   └── payments/
│   │       ├── billing/route.ts
│   │       └── webhook/route.ts
│   └── page.tsx                       ← landing page
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── ai/
│   │   ├── client.ts                  ← shared Solar Pro 4 instance
│   │   ├── explainMatch.ts
│   │   └── generateDocument.ts
│   └── matching.ts
├── components/
│   ├── ProgramCard.tsx
│   ├── OnboardingWizard.tsx
│   ├── MatchExplanation.tsx
│   ├── DocumentGenerator.tsx
│   └── ApplicationTracker.tsx
├── scripts/
│   └── sync-programs.ts               ← run locally to seed DB
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
└── vercel.json
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # admin access for sync script

# Upstage (Solar Pro 4)
UPSTAGE_API_KEY=

# 공공데이터포털 — use decoded == not %3D%3D
BIZINFO_API_KEY=

# 토스페이먼츠
TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=

# Resend (email)
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://eunwon.com
SUPABASE_STORAGE_BUCKET=user-documents

# Cron security
CRON_SECRET=
```

---

## Monthly Cost Estimate

| Service | Cost |
|---|---|
| Vercel (Hobby → Pro when needed) | $0–20 |
| Supabase (Free tier) | $0 |
| Upstage Solar Pro 4 | ~$3–5 |
| Resend (Free: 3k emails/month) | $0 |
| Domain (eunwon.com) | ~$1 |
| **Total costs** | **~$4–6/month** |

**Revenue:**
- 20 Pro users → ₩780,000/month (~$580)
- 50 Pro users → ₩1,950,000/month (~$1,450)
- 100 Pro users → ₩3,900,000/month (~$2,900)

Profitable from the first ~5 paying users.

---

## Full Phased Build Plan

### Phase 1 — Data Foundation ✅ Complete
*API key, sync script, database populated*

- [x] Register at data.go.kr, obtain 기업마당 API key
- [x] Confirm API endpoint and map real response fields
- [x] Write `scripts/sync-programs.ts`
- [x] Create Supabase project, run schema migrations
- [x] Run sync script locally — database populated
- [x] Verify data in Supabase table viewer

---

### Phase 2 — Core Product ✅ Complete
*Working app where users sign up and see matched programs*

- [x] Create Next.js project with Tailwind + shadcn/ui
- [x] Configure Supabase Auth
- [x] Build onboarding form → saves to `profiles`
- [x] Build dashboard with matched programs
- [x] Build program detail page
- [x] Add deadline badges, bookmark functionality
- [x] Auth middleware

---

### Phase 3 — Make It Irreplaceable (Next)
*Add the features that justify paying and that no LLM can replicate*

**3a — Real Eligibility Filtering** *(1 weekend)*
- [ ] Extend `profiles` table — add `founded_at`, `age_months`, `certifications`, `current_challenges`
- [ ] Update onboarding wizard with new fields (4 steps)
- [ ] Update `getMatchedPrograms()` to hard-filter on `age_months`, `entity_type`, `region`
- [ ] Show "N개 사업이 귀사에 맞습니다" count on dashboard

**3b — 사업계획서 Generation** *(1–2 weekends)*
- [ ] Build `/program/[id]/generate` page with step-by-step preview
- [ ] Implement generation API route (profile + program → Solar Pro 4 → draft)
- [ ] Export as `.docx` using the `docx` npm package
- [ ] Track generation count — gate at 5/month for Pro
- [ ] Add "필요 서류 체크리스트" from `apply_method` field

**3c — Application Tracking** *(1 weekend)*
- [ ] Add save button to program cards
- [ ] Build `/dashboard/saved` with status columns: 저장됨 → 신청함 → 결과대기 → 완료
- [ ] Store outcome when user marks complete (선정/탈락)
- [ ] Flag potential 중복수혜 conflicts based on stored outcomes

---

### Phase 4 — Monetization & Alerts *(2 weekends)*

- [ ] 토스페이먼츠 빌링키 발급 flow
- [ ] Free tier limit enforcement (5 matches/day shown without Pro)
- [ ] Pro gate on: AI explanation, document generation, unlimited matches
- [ ] Deadline alert cron (`0 0 * * *` = 09:00 KST)
- [ ] "New match" email when sync adds qualifying programs
- [ ] Notification preferences in settings

---

### Phase 5 — Document Vault *(1–2 weekends)*

- [ ] Set up Supabase Storage bucket (private, row-level security)
- [ ] Upload UI in `/settings/documents`
- [ ] PDF text extraction for context feeding
- [ ] Pass stored documents as context in document generation
- [ ] "사업자등록증 업로드" prompt during onboarding

---

### Phase 6 — Launch

- [ ] Landing page: "놓치고 있는 지원사업을 찾아드립니다"
- [ ] 카카오 OAuth (higher conversion for Korean users)
- [ ] Sentry error monitoring (free tier)
- [ ] Post in Naver 소상공인 카페, 스타트업 커뮤니티
- [ ] Offer free Pro for first 20 users in exchange for feedback
- [ ] Vercel Analytics

---

### Phase 7 — Growth (Post-launch)

- [ ] B2B tier for 세무사/컨설턴트 (multi-client dashboard, ₩200,000/month)
- [ ] KakaoTalk 알림톡 notifications
- [ ] K-Startup API as second data source
- [ ] Match score display (% of eligibility criteria met)
- [ ] Referral program
- [ ] Mobile-optimized PWA

---

## Immediate Next Steps

The service is working. To make it irreplaceable, build these in order:

1. **Extend the `profiles` table** — add `founded_at`, `age_months` (generated), `certifications`, `current_challenges`. Run in Supabase SQL editor.

2. **Update the onboarding wizard** — add the new fields. Gate dashboard behind completion for new users.

3. **Update matching logic** — add `age_months` and `entity_type` filters. This alone will dramatically improve result relevance.

4. **Add a save button** — simple `saved_programs` insert. No kanban yet. Creates retention immediately.

5. **Build the document generation endpoint** — this is the unlock for paid conversions. Everything needed is already in the DB.

---

*Eunwon AI — eunwon.com*
*Founded by 이은원 — 은 (silver) + 원 (circle)*
