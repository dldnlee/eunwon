'use client';

// ProgramCard has a real interactive bookmark button, which needs a client-component
// boundary to attach its handler to — this file has no server-only data fetching
// (all fixture data), so making it a client component costs nothing.
import { ProgramCard } from '@/components/ProgramCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Program } from '@/lib/types';
import { Sparkles, Bookmark } from 'lucide-react';

/**
 * Renders the actual dashboard/detail-page components with realistic fixture
 * data, instead of static screenshot images — same components, same tokens,
 * so this can never drift out of sync with what a real signed-in user sees,
 * and survives future redesigns automatically. Deadlines are computed
 * relative to render time so the D-day badges never look stale on a page
 * that stays live for months.
 */

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function buildSampleProgram(overrides: Partial<Program> & Pick<Program, 'id' | 'title' | 'agency'>): Program {
  return {
    external_id: overrides.id,
    source: 'bizinfo',
    exec_agency: null,
    category: null,
    target_raw: null,
    description: null,
    apply_method: null,
    apply_steps: [],
    apply_url: null,
    detail_url: null,
    deadline_start: null,
    deadline_end: null,
    region: ['서울'],
    entity_types: ['법인'],
    is_nationwide: false,
    hashtags_raw: null,
    max_age_months: null,
    min_age_months: null,
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
    ai_summary: null,
    ai_tags: [],
    is_active: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const SAMPLE_PROGRAMS: Program[] = [
  buildSampleProgram({
    id: 'sample-1',
    title: '2026년 AI 스타트업 기술사업화 지원사업 참여기업 모집 공고',
    agency: '중소벤처기업부',
    category: '기술',
    deadline_end: daysFromNow(6),
    ai_summary: 'AI 기반 기술을 보유한 서울 소재 중소기업을 대상으로 최대 2억 원의 사업화 자금과 기술 컨설팅을 지원합니다.',
  }),
  buildSampleProgram({
    id: 'sample-2',
    title: '2026년 청년 스타트업 해외 진출 지원사업 모집 공고',
    agency: '중소벤처기업부',
    category: '수출',
    deadline_end: daysFromNow(23),
    ai_summary: '해외 진출을 준비 중인 창업 7년 이내 기업을 대상으로 현지화 컨설팅과 마케팅 비용을 지원합니다.',
  }),
];

const SAMPLE_MATCH_RATES: Record<string, number> = { 'sample-1': 92, 'sample-2': 78 };
const SAMPLE_AI_RATINGS: Record<string, { matchRate: number; reason: string }> = {
  'sample-1': { matchRate: 95, reason: 'AI/소프트웨어 분야 서울 소재 기업과 조건이 정확히 일치해요' },
  'sample-2': { matchRate: 74, reason: '수출 준비 단계와 업력 조건이 잘 맞아요' },
};

/** Small "browser chrome" frame so each preview reads as an actual app screen, not a loose card. */
function BrowserFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/60 bg-canvas shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-sm border-b border-hairline-soft bg-surface px-md py-sm">
        <span className="flex gap-xxs" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
          <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
          <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
        </span>
        <span className="mx-auto rounded-full bg-canvas px-md py-xxs text-caption text-stone">{label}</span>
      </div>
      <div className="pointer-events-none p-lg sm:p-xl">{children}</div>
    </div>
  );
}

function DetailPagePreview() {
  return (
    <div className="flex flex-col gap-lg">
      <div>
        <div className="mb-sm flex flex-wrap gap-xs">
          <Badge variant="outline">기술</Badge>
          <Badge>서울</Badge>
        </div>
        <h3 className="text-card-title text-ink">
          2026년 AI 스타트업 기술사업화 지원사업 참여기업 모집 공고
        </h3>
        <p className="mt-xs text-body-sm text-steel">중소벤처기업부</p>
      </div>

      <div className="flex flex-wrap gap-sm">
        <span className="inline-flex h-9 items-center gap-xs rounded-full border border-hairline px-md text-body-sm text-steel">
          <Bookmark className="h-4 w-4" aria-hidden="true" /> 저장
        </span>
        <Button size="sm">신청 페이지로 이동</Button>
      </div>

      <Card className="border-brand-blue-200 bg-brand-blue-200/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-xs text-card-title">
            <Sparkles className="h-4 w-4 text-brand-blue-deep" aria-hidden="true" /> 왜 나에게 맞나요?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body-sm text-charcoal">
            서울 소재 IT/소프트웨어 기업이고, 기업부설연구소를 보유하고 있어 이 사업의 핵심 지원
            대상과 정확히 일치해요. 특히 AI 기술 분야 사업화 자금 지원 조건을 모두 충족합니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>신청 방법</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-sm">
            {['사업 신청서와 사업계획서를 준비한다.', '온라인 접수 시스템에서 신청서를 제출한다.', '서류 심사 및 발표 평가를 거쳐 최종 선정된다.'].map((step, i) => (
              <li key={i} className="flex gap-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-caption font-semibold text-on-primary">
                  {i + 1}
                </span>
                <p className="text-body-sm leading-relaxed text-charcoal">{step}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-sm p-lg text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-body-sm text-charcoal">사업계획서 초안을 AI로 작성해드려요.</p>
          <Button size="sm" className="shrink-0">사업계획서 생성</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProductShowcase() {
  return (
    <section className="relative mx-auto max-w-6xl px-xl py-section">
      <div className="mx-auto max-w-2xl text-center">
        <Badge className="mb-md border border-white/60 bg-canvas/50 text-brand-blue-deep backdrop-blur-xl">
          미리보기
        </Badge>
        <h2 className="text-heading-md text-ink">가입 전에 먼저 확인해보세요</h2>
        <p className="mt-sm text-body-md text-steel">
          실제 화면 그대로예요. 매칭된 지원사업을 한눈에 보고, 각 공고의 상세 페이지에서
          AI 설명과 신청 방법까지 바로 확인할 수 있어요.
        </p>
      </div>

      <div className="mt-xxl grid gap-xl lg:grid-cols-2">
        <div>
          <BrowserFrame label="eunwon.ai/dashboard">
            <div className="flex flex-col gap-md">
              {SAMPLE_PROGRAMS.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  matchScorePercent={SAMPLE_MATCH_RATES[program.id]}
                  aiRating={SAMPLE_AI_RATINGS[program.id]}
                />
              ))}
            </div>
          </BrowserFrame>
          <p className="mt-md text-center text-body-sm text-steel sm:text-left">
            매칭도와 AI 매칭도를 함께 보여드려 어떤 사업부터 신청할지 바로 판단할 수 있어요.
          </p>
        </div>

        <div>
          <BrowserFrame label="eunwon.ai/program/...">
            <DetailPagePreview />
          </BrowserFrame>
          <p className="mt-md text-center text-body-sm text-steel sm:text-left">
            공고문을 다 읽지 않아도, AI가 왜 나에게 맞는지와 신청 방법을 정리해드려요.
          </p>
        </div>
      </div>
    </section>
  );
}
