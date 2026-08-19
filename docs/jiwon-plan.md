# 정부지원사업 매칭 서비스 — Build Plan

## Overview

A SaaS product that helps Korean SMBs and startups find relevant government support programs (정부지원사업) by matching their business profile against a curated, up-to-date database of programs. Upstage Solar Pro 4 (via the Vercel AI SDK) powers data enrichment and match explanations to make the experience feel intelligent without heavy engineering. As a Korean AI company, Upstage's Solar models have particularly strong Korean language quality — a natural fit for this product.

**Target users:** 소상공인, 스타트업, 중소기업 owners — and eventually 세무사/컨설턴트 firms as power users.

**Business model:** Monthly subscription via 토스페이먼츠. Free tier (5 matches), Pro tier ₩39,000/month (unlimited matches + AI summaries + application drafts).

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend + API | Next.js 14 (App Router) | Familiar, handles SSR + API routes in one project |
| Database + Auth | Supabase | Familiar, Postgres + built-in auth + Edge Functions |
| AI | Upstage Solar Pro 4 (Vercel AI SDK) | Korean AI company, strong Korean language quality, OpenAI-compatible API |
| Payments | 토스페이먼츠 | Standard for Korean products, good Next.js SDK |
| Deployment | Vercel | Zero-config for Next.js, built-in cron support |
| Styling | Tailwind CSS + shadcn/ui | Fast to build clean UI |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Vercel (Next.js)                    │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │  App Pages  │  │  API Routes │  │  Cron Jobs     │  │
│  │  /onboard   │  │  /match     │  │  /sync-programs│  │
│  │  /dashboard │  │  /profile   │  │  (nightly)     │  │
│  │  /program   │  │  /payments  │  └────────────────┘  │
│  └─────────────┘  └─────────────┘                       │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
   ┌──────▼──────┐ ┌─────▼──────┐ ┌────▼───────────┐
   │  Supabase   │ │  Upstage   │ │  공공데이터포털  │
   │  (Postgres  │ │  API       │ │  기업마당 API   │
   │  + Auth)    │ │  (Solar)   │ │  K-Startup API │
   └─────────────┘ └────────────┘ └────────────────┘
```

---

## Database Schema

### `programs` table
Stores all government support programs, synced nightly.

```sql
create table programs (
  id              uuid primary key default gen_random_uuid(),
  external_id     text unique not null,       -- ID from source API
  source          text not null,              -- 'bizinfo' | 'kstartup' | 'manual'
  title           text not null,
  agency          text not null,              -- 주관기관 (e.g. 중소벤처기업부)
  category        text,                       -- 융자 | 보조금 | 보증 | 교육 | 컨설팅
  region          text[],                     -- ['전국'] or ['서울', '경기']
  business_types  text[],                     -- eligible 업종 codes
  min_employees   int,
  max_employees   int,
  min_revenue     bigint,                     -- 연매출 (원)
  max_revenue     bigint,
  min_age_months  int,                        -- 업력 in months
  max_age_months  int,
  entity_types    text[],                     -- ['법인', '개인사업자', '예비창업자']
  amount_text     text,                       -- e.g. "최대 1억원"
  amount_max      bigint,                     -- parsed max amount in 원
  deadline        date,
  apply_url       text,
  description     text,                       -- raw description from API
  ai_summary      text,                       -- AI-generated plain Korean summary
  ai_tags         text[],                     -- AI-extracted tags
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Index for fast filtering
create index on programs (deadline, is_active);
create index on programs using gin (region);
create index on programs using gin (business_types);
create index on programs using gin (entity_types);
```

### `profiles` table
One row per user — their business profile used for matching.

```sql
create table profiles (
  id              uuid primary key references auth.users(id),
  business_name   text,
  business_type   text not null,              -- 업종 code
  region          text not null,              -- 시/도
  entity_type     text not null,              -- 법인 | 개인사업자 | 예비창업자
  employee_count  int,
  annual_revenue  bigint,                     -- 원
  founded_at      date,                       -- to calculate 업력
  is_tech_company boolean default false,
  extra_tags      text[],                     -- user-selected tags: 여성기업, 장애인기업 etc.
  subscription    text default 'free',        -- 'free' | 'pro'
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

### `saved_programs` table
Programs a user has bookmarked.

```sql
create table saved_programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  program_id  uuid references programs(id),
  notes       text,
  created_at  timestamptz default now(),
  unique (user_id, program_id)
);
```

### `notifications` table
Tracks which programs a user has been notified about (to avoid duplicates).

```sql
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  program_id  uuid references programs(id),
  sent_at     timestamptz default now()
);
```

---

## Data Pipeline

### Source APIs

**1. 기업마당 (bizinfo.go.kr) via 공공데이터포털**
The main source. Register at data.go.kr to get an API key.
- Endpoint: `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do`
- Returns paginated XML/JSON of active support programs
- Fields include: 사업명, 지원내용, 신청기간, 지원규모, 주관기관, 접수방법

**2. K-Startup (k-startup.go.kr)**
Focused on early-stage startup programs.
- Has a public API for 공고 listings
- Good for 예비창업자 and 초기창업자 programs

**3. Manual curation**
Some high-value programs (e.g. 창업진흥원 팁스) are better managed manually due to complex eligibility criteria.

### Sync Job (`/api/cron/sync-programs`)

Run nightly via Vercel Cron (`vercel.json`):

```json
{
  "crons": [{
    "path": "/api/cron/sync-programs",
    "schedule": "0 2 * * *"
  }]
}
```

The sync job flow:
1. Fetch all active programs from 기업마당 API (paginate through results)
2. For each program, check if `external_id` already exists in Supabase
3. If new → insert + call Solar Pro 4 to generate `ai_summary` and `ai_tags`
4. If existing → update changed fields, flag if deadline passed
5. Mark programs not in latest API response as `is_active = false`

---

## Upstage Solar Pro 4 Integration (Vercel AI SDK)

Solar Pro 4 is used in two places: **data enrichment at ingestion** and **match explanation at runtime**. Both are low-token, focused tasks — and Solar's strong Korean language training makes it a particularly good fit for generating natural-sounding Korean summaries and explanations.

### Setup

Install the required packages:

```bash
npm install ai @ai-sdk/openai-compatible
```

Create a shared model instance:

```typescript
// lib/ai/client.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const upstage = createOpenAICompatible({
  name: 'upstage',
  baseURL: 'https://api.upstage.ai/v1',
  apiKey: process.env.UPSTAGE_API_KEY!,
});

// Export the model — import this wherever AI is needed
// Confirm the exact model ID in the Upstage API docs: https://developers.upstage.ai
export const model = upstage('solar-pro');
```

> **API Key:** Get your `UPSTAGE_API_KEY` from the [Upstage developer console](https://console.upstage.ai). Check the docs to confirm the exact model ID string for Solar Pro 4 — it may appear as `solar-pro`, `solar-pro2`, or a versioned variant.

---

### 1. Data Enrichment (ingestion time)

When a new program is synced, pass its raw description to Qwen to extract structured information and generate a clean Korean summary. This runs once per program, not per user request.

```typescript
// lib/ai/enrichProgram.ts
import { generateText } from 'ai';
import { model } from './client';

export async function enrichProgram(rawDescription: string, title: string) {
  const { text } = await generateText({
    model,
    maxTokens: 512,
    prompt: `다음 정부지원사업의 설명을 분석해서 JSON으로 반환해주세요.

사업명: ${title}
설명: ${rawDescription}

다음 형식으로만 응답하세요 (JSON 외 다른 텍스트 없이):
{
  "summary": "2-3문장으로 핵심만 요약한 한국어 설명",
  "tags": ["관련태그1", "관련태그2"],
  "category": "융자|보조금|보증|교육|컨설팅|기타",
  "key_benefit": "핵심 혜택 한 줄 요약"
}`,
  });

  return JSON.parse(text);
}
```

### 2. Match Explanation (runtime, Pro users only)

When a Pro user views their matched programs, generate a brief personalized explanation of why each program is relevant to their specific business. This is a key differentiator from simply showing a filtered list.

```typescript
// lib/ai/explainMatch.ts
import { generateText } from 'ai';
import { model } from './client';

export async function explainMatch(program: Program, profile: Profile) {
  const { text } = await generateText({
    model,
    maxTokens: 200,
    prompt: `사용자의 사업과 지원사업의 매칭 이유를 1-2문장으로 설명해주세요.

사용자 정보:
- 업종: ${profile.business_type}
- 지역: ${profile.region}
- 업력: ${getAgeMonths(profile.founded_at)}개월
- 직원수: ${profile.employee_count}명

지원사업: ${program.title}
요약: ${program.ai_summary}

왜 이 사업이 이 사용자에게 적합한지 구체적으로 설명하세요. 친근하고 명확한 한국어로 작성하세요.`,
  });

  return text;
}
```

### 3. Application Draft Assistant (Pro users only)

A simple prompt that helps users draft a 사업계획서 outline based on the program's requirements.

```typescript
// lib/ai/draftApplication.ts
import { generateText } from 'ai';
import { model } from './client';

export async function draftApplicationOutline(
  program: Program,
  profile: Profile
) {
  const { text } = await generateText({
    model,
    maxTokens: 1024,
    prompt: `다음 정부지원사업 신청을 위한 사업계획서 목차와 각 항목의 작성 가이드를 제공해주세요.

지원사업: ${program.title}
지원내용: ${program.ai_summary}
신청기업 업종: ${profile.business_type}
신청기업 지역: ${profile.region}

실용적이고 구체적인 작성 가이드를 마크다운 형식으로 제공하세요.`,
  });

  return text;
}
```

### Cost Estimate

Check current Solar Pro 4 pricing at [developers.upstage.ai](https://developers.upstage.ai) — Upstage pricing is competitive with other mid-tier models. As a rough guide at typical rates:
- Enrichment per program: ~300 input + 150 output tokens ≈ ~$0.001–0.002 per program
- 1,000 new programs/month ≈ **~$1–2/month** for enrichment
- Match explanation per Pro user dashboard load: ~200 tokens × 10 matches ≈ ~$0.001 per load
- 100 Pro users × 20 loads/month ≈ **~$2/month** for explanations

Total AI cost at 100 Pro users: roughly **$3–4/month** — still negligible against ₩3,900,000/month in revenue. Verify exact per-token rates in the console before launch.

---

## Matching Logic

The core matching query runs in Supabase. No AI needed here — pure SQL filtering.

```typescript
// lib/matching.ts
export async function getMatchedPrograms(profile: Profile) {
  const ageMonths = getAgeMonths(profile.founded_at);
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .gte('deadline', today)
    .or(`region.cs.{"전국"},region.cs.{"${profile.region}"}`)
    .or(`min_employees.is.null,min_employees.lte.${profile.employee_count}`)
    .or(`max_employees.is.null,max_employees.gte.${profile.employee_count}`)
    .or(`min_age_months.is.null,min_age_months.lte.${ageMonths}`)
    .or(`max_age_months.is.null,max_age_months.gte.${ageMonths}`)
    .contains('entity_types', [profile.entity_type])
    .order('deadline', { ascending: true })
    .limit(50);

  return data;
}
```

A **match score** can be added later to rank results by relevance — programs matching more criteria rank higher. Keep it simple at launch.

---

## Frontend Pages

### 1. Landing Page (`/`)
- Value proposition headline
- "내 사업에 맞는 지원사업 찾기" CTA
- Brief demo or screenshot
- Pricing section
- 로그인 / 회원가입 button

### 2. Onboarding Flow (`/onboarding`)
Multi-step form — collects business profile after signup. 5 steps, each with 1-2 questions:

1. **사업 형태** — 예비창업자 | 개인사업자 | 법인
2. **업종** — searchable dropdown using 한국표준산업분류
3. **지역** — 시/도 selector
4. **규모** — 직원수 slider, 연매출 input
5. **추가 정보** — 업력 (창업일), 특이사항 (여성기업, 기술기업 등)

### 3. Dashboard (`/dashboard`)
Main screen after login. Shows:
- Matched programs list with deadline badges
- Filter sidebar: category, region, amount range
- Each card shows: title, agency, deadline, amount, AI summary, "왜 나에게 맞나요?" button (Pro)
- Bookmark button on each card
- "마감 임박" highlight for programs closing within 7 days

### 4. Program Detail (`/program/[id]`)
- Full program information
- AI-generated plain Korean summary
- Direct link to application page
- "신청서 초안 작성" button (Pro) — opens application draft assistant
- Share button

### 5. Saved Programs (`/saved`)
- User's bookmarked programs
- Notes field per program
- Quick status tracking (관심 | 신청중 | 완료)

### 6. Settings (`/settings`)
- Update business profile
- Notification preferences (email alerts for new matching programs)
- Subscription management (upgrade/cancel)

---

## Authentication

Use Supabase Auth with:
- **이메일/비밀번호** — primary method
- **카카오 OAuth** — high conversion for Korean users; add in v2

On first login, redirect to `/onboarding` if no profile exists, otherwise to `/dashboard`.

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createMiddlewareClient({ req: request, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

---

## Payments (토스페이먼츠)

Use 토스페이먼츠 정기결제 (billing) for monthly subscriptions.

**Flow:**
1. User clicks "Pro로 업그레이드" on dashboard
2. Redirect to 토스페이먼츠 결제창 (빌링키 발급)
3. On success, store `billingKey` in Supabase, update `profiles.subscription = 'pro'`
4. Monthly: Vercel Cron charges stored billing keys via 토스페이먼츠 API
5. On failure/cancellation: downgrade to free tier

**Pro feature gating:**
```typescript
// Simple server-side check
const { data: profile } = await supabase
  .from('profiles')
  .select('subscription')
  .eq('id', userId)
  .single();

if (profile.subscription !== 'pro') {
  return NextResponse.json({ error: 'Pro 플랜이 필요합니다' }, { status: 403 });
}
```

---

## Notification System

A daily Vercel Cron job (`0 9 * * *` — 오전 9시) checks for new programs that match each user's profile and haven't been notified yet, then sends emails via Supabase's built-in email or a free-tier Resend account.

```
/api/cron/notify-users
1. For each active user with email notifications enabled:
   a. Run matching query
   b. Filter out programs already in their `notifications` table
   c. If new matches exist → send email summary
   d. Insert rows into `notifications` to prevent re-sending
```

---

## Phased Build Plan

### Phase 1 — Data Foundation (Week 1-2)
**Goal:** Have a populated, queryable database of real programs.

- [ ] Register at data.go.kr and get 기업마당 API key
- [ ] Explore and map the API response fields
- [ ] Create Supabase project, run schema migrations
- [ ] Write the sync script (Node.js, run locally first)
- [ ] Integrate Solar Pro 4 enrichment into sync script (via Vercel AI SDK)
- [ ] Manually seed ~50 programs to validate schema
- [ ] Deploy sync job as Vercel Cron

**Milestone:** Run `getMatchedPrograms()` in a test script and get real results back.

---

### Phase 2 — Core Product (Week 3-5)
**Goal:** A working app where a real user can sign up, enter their profile, and see matched programs.

- [ ] Set up Next.js project with Tailwind + shadcn/ui
- [ ] Configure Supabase Auth (email/password)
- [ ] Build onboarding form (5 steps, save to `profiles`)
- [ ] Build dashboard with matching query results
- [ ] Build program detail page
- [ ] Add deadline badge colors (red = <7 days, yellow = <30 days)
- [ ] Add bookmark functionality
- [ ] Set up middleware for auth-protected routes

**Milestone:** You can personally use the app to find real programs matching your own (or a test) business profile.

---

### Phase 3 — AI Features + Payments (Week 6-8)
**Goal:** Differentiated Pro features and a working payment flow.

- [ ] Add "왜 나에게 맞나요?" match explanation (Solar Pro 4, Pro only)
- [ ] Add application draft assistant page (Solar Pro 4, Pro only)
- [ ] Integrate 토스페이먼츠 빌링키 발급 flow
- [ ] Build settings page (profile edit + subscription management)
- [ ] Add free tier limit (show only 5 matches without Pro)
- [ ] Add notification email (Resend free tier)

**Milestone:** A friend can sign up, get matched programs, and pay for Pro.

---

### Phase 4 — Launch (Week 9-10)
**Goal:** Real users, real feedback.

- [ ] Write landing page copy (focus on the ROI: "놓치고 있는 지원사업을 찾아드립니다")
- [ ] Add 카카오 OAuth for easier signup
- [ ] Set up error monitoring (Sentry free tier)
- [ ] Post in Naver 소상공인 카페 and 스타트업 커뮤니티 — offer free Pro for first 20 users
- [ ] Set up simple analytics (Vercel Analytics or Plausible)

**Milestone:** 20+ real users actively using the product.

---

### Phase 5 — Growth (Post-launch)
**Goal:** Move toward paying customers and reduce churn.

- [ ] B2B tier for 세무사/컨설턴트 firms (multi-client dashboard)
- [ ] KakaoTalk notification channel (via Kakao 알림톡 API)
- [ ] Program application status tracker
- [ ] 지자체 programs (local government sources beyond 기업마당)
- [ ] Referral program

---

## Project Structure

```
/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/
│   │   ├── dashboard/page.tsx
│   │   ├── program/[id]/page.tsx
│   │   ├── saved/page.tsx
│   │   └── settings/page.tsx
│   ├── onboarding/page.tsx
│   ├── api/
│   │   ├── cron/
│   │   │   ├── sync-programs/route.ts
│   │   │   └── notify-users/route.ts
│   │   ├── match/route.ts
│   │   ├── ai/
│   │   │   ├── explain/route.ts
│   │   │   └── draft/route.ts
│   │   └── payments/
│   │       ├── billing/route.ts
│   │       └── webhook/route.ts
│   └── page.tsx  (landing)
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── ai/
│   │   ├── enrichProgram.ts
│   │   ├── explainMatch.ts
│   │   └── draftApplication.ts
│   ├── matching.ts
│   └── payments.ts
├── components/
│   ├── ProgramCard.tsx
│   ├── OnboardingForm.tsx
│   ├── MatchExplanation.tsx
│   └── DraftAssistant.tsx
├── scripts/
│   └── seed-programs.ts    (local dev only)
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Upstage (Solar Pro 4)
UPSTAGE_API_KEY=

# 공공데이터포털
BIZINFO_API_KEY=

# 토스페이먼츠
TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=

# Resend (email)
RESEND_API_KEY=

# Cron security
CRON_SECRET=
```

---

## Monthly Cost Estimate (at 100 Pro users)

| Service | Cost |
|---|---|
| Vercel (Hobby) | $0 |
| Supabase (Free tier) | $0 |
| Upstage Solar Pro 4 | ~$3–4 |
| Resend (Free tier, 3k emails/mo) | $0 |
| Domain | ~$1 |
| **Total costs** | **~$5/month** |
| **Revenue (100 × ₩39,000)** | **~₩3,900,000/month** |

Even at 20 paying users (₩780,000/month) this is a profitable side project that covers its own costs many times over.

---

## First Step This Week

Before writing any code, do this:

1. Go to [data.go.kr](https://www.data.go.kr)
2. Search for "기업마당" and apply for API access (takes 1-2 days to approve)
3. While waiting — read the API documentation and map the response fields to the `programs` schema above
4. Spin up a Supabase project and run the schema SQL

That's it. Everything else follows naturally once you have real data flowing.
