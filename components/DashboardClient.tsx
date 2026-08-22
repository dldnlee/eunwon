'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ProgramCard } from '@/components/ProgramCard';
import { EventCard } from '@/components/EventCard';
import { DashboardSummary } from '@/components/DashboardSummary';
import { PillTabs, type PillTabItem } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TOSS_ENABLED } from '@/lib/payments';
import { matchPercent, getProgramBucket, type ProgramBucket } from '@/lib/matching';
import { categoryLabel, daysUntil } from '@/lib/utils';
import type { ProgramMatchRating } from '@/lib/ai/rateProgramMatch';
import { SearchX, CalendarClock, Info } from 'lucide-react';
import type { Program, Profile, Event } from '@/lib/types';

// Smaller than before now that each request also sends descriptions (not just titles) server-side
// for re-fetching — keeps each batch's prompt/response size reasonable.
const AI_RATING_BATCH_SIZE = 10;

type TabValue = '전체' | '지원사업' | '공모전' | '대출' | '행사';

const PROGRAM_TABS: { value: Exclude<TabValue, '전체' | '행사'>; bucket: ProgramBucket }[] = [
  { value: '지원사업', bucket: 'program' },
  { value: '공모전', bucket: 'contest' },
  { value: '대출', bucket: 'loan' },
];

/** Options for the match-rate filter. matchPercent() is anchored at a 50% floor and tops out
 *  at 100%, so every option here is guaranteed to be able to actually exclude something. */
const MATCH_RATE_OPTIONS = [
  { value: 0, label: '전체' },
  { value: 70, label: '70% 이상' },
  { value: 90, label: '90% 이상' },
];

const MATCH_TOOLTIP =
  '매칭도: 지역·업력·직원수·인증 등 실제로 확인된 조건을 기준으로 계산한 점수예요. 이 목록에 뜬 지원사업은 이미 이 조건들을 통과했어요.';
const AI_MATCH_TOOLTIP =
  'AI 매칭도: AI가 지원사업의 "제목과 상세 내용"을 보고 판단한 참고용 점수예요. 매칭도(자격 조건 기반)와 달리 AI의 해석에 따라 달라질 수 있는 보조 지표예요.';

function sortByMatch(programs: Program[], profile: Profile): Program[] {
  return [...programs].sort((a, b) => matchPercent(b, profile) - matchPercent(a, profile));
}

function ProgramEmptyState({
  isFiltered,
  bucketIsEmpty,
  bucketEmptyCopy,
  onReset,
}: {
  isFiltered: boolean;
  bucketIsEmpty: boolean;
  bucketEmptyCopy: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-hairline p-xxl text-center">
      <SearchX className="h-8 w-8 text-stone" aria-hidden="true" />
      <p className="text-body-sm text-steel">
        {bucketIsEmpty ? bucketEmptyCopy : '조건에 맞는 지원사업이 없어요. 필터를 조정해보세요.'}
      </p>
      {isFiltered && !bucketIsEmpty && (
        <Button variant="outline" size="sm" onClick={onReset} className="mt-xs">
          필터 초기화
        </Button>
      )}
    </div>
  );
}

const BUCKET_EMPTY_COPY: Record<Exclude<TabValue, '전체' | '행사'>, string> = {
  지원사업: '아직 조건에 맞는 지원사업이 없어요. 프로필 정보가 갱신되면 다시 확인해드릴게요.',
  공모전: '지금은 조건에 맞는 공모전이 없어요. 공모전은 상시 등록되는 지원사업보다 수가 적어서 없을 때가 많아요. 새 공모전이 열리면 이곳에 표시됩니다.',
  대출: '아직 조건에 맞는 대출·보증 지원사업이 없어요. 새로운 정책자금이 열리면 이곳에 표시됩니다.',
};

export function DashboardClient({
  userId,
  profile,
  initialPrograms,
  initialEvents,
  savedProgramIds,
  isPro,
  freeLimit,
}: {
  userId: string;
  profile: Profile;
  initialPrograms: Program[];
  initialEvents: Event[];
  savedProgramIds: string[];
  isPro: boolean;
  freeLimit: number;
}) {
  const [saved, setSaved] = useState<Set<string>>(new Set(savedProgramIds));
  const [activeTab, setActiveTab] = useState<TabValue>('전체');
  const [category, setCategory] = useState('전체');
  const [region, setRegion] = useState('전체');
  const [minMatchPercent, setMinMatchPercent] = useState(0);
  const [minAiMatchPercent, setMinAiMatchPercent] = useState(0);
  const [aiRatings, setAiRatings] = useState<Record<string, ProgramMatchRating>>({});
  // Tracks ids currently in flight so a re-render mid-request doesn't fire a duplicate batch —
  // separate from aiRatings itself since "requested but not back yet" isn't a rating.
  const requestedIds = useRef<Set<string>>(new Set());

  const bucketPrograms = useMemo(() => {
    const map: Record<ProgramBucket, Program[]> = { program: [], contest: [], loan: [] };
    for (const p of initialPrograms) map[getProgramBucket(p)].push(p);
    return map;
  }, [initialPrograms]);

  // The set of programs the active tab draws from, before category/region/match filters.
  const tabSource = useMemo(() => {
    if (activeTab === '행사') return [];
    if (activeTab === '전체') return initialPrograms;
    const bucket = PROGRAM_TABS.find((t) => t.value === activeTab)?.bucket;
    return bucket ? bucketPrograms[bucket] : [];
  }, [activeTab, initialPrograms, bucketPrograms]);

  const showFilters = activeTab !== '행사';

  const categories = useMemo(
    () => ['전체', ...Array.from(new Set(tabSource.map((p) => p.category).filter(Boolean)))] as string[],
    [tabSource]
  );
  const regions = useMemo(
    () => ['전체', ...Array.from(new Set(tabSource.flatMap((p) => p.region)))],
    [tabSource]
  );

  // Rule-based filters only (category/region/매칭도) — this, not the final AI-filtered list,
  // is what drives which programs get sent for an AI rating below. Basing the AI request on the
  // AI-filtered result would be circular: a program excluded for not (yet) meeting the AI
  // threshold would never get requested in the first place, since it isn't rated yet.
  const matchFilteredPrograms = useMemo(() => {
    const filtered = tabSource.filter((p) => {
      if (category !== '전체' && p.category !== category) return false;
      if (region !== '전체' && !p.region.includes(region) && !p.is_nationwide) return false;
      if (minMatchPercent > 0 && matchPercent(p, profile) < minMatchPercent) return false;
      return true;
    });
    return sortByMatch(filtered, profile);
  }, [tabSource, category, region, minMatchPercent, profile]);

  // Final list, with the AI-매칭도 threshold applied on top. A program with no rating yet is
  // excluded (not assumed to pass) while this filter is active — it reappears once its rating
  // comes in, if it qualifies. See the "AI가 분석 중" note near the filter for why the list can
  // grow after the page has already rendered.
  const filteredPrograms = useMemo(() => {
    if (minAiMatchPercent === 0) return matchFilteredPrograms;
    return matchFilteredPrograms.filter((p) => (aiRatings[p.id]?.matchRate ?? -1) >= minAiMatchPercent);
  }, [matchFilteredPrograms, minAiMatchPercent, aiRatings]);

  const visiblePrograms = isPro ? filteredPrograms : filteredPrograms.slice(0, freeLimit);
  const hiddenCount = isPro ? 0 : Math.max(0, filteredPrograms.length - freeLimit);
  const isFiltered = category !== '전체' || region !== '전체' || minMatchPercent > 0 || minAiMatchPercent > 0;
  const aiFilterPending =
    minAiMatchPercent > 0 && matchFilteredPrograms.some((p) => !(p.id in aiRatings));

  // AI's title + 상세 내용 second opinion (lib/ai/rateProgramMatch.ts) — Pro-only, runs
  // automatically as cards come into view rather than behind a button. Drawn from
  // matchFilteredPrograms (every program the rule-based filters allow, regardless of the AI
  // filter — see above), batched, and only for ids not already rated or already in flight —
  // switching tabs or paging never re-asks for a program this session has already gotten a
  // rating for. Only ids are sent — the route re-fetches title/description server-side.
  useEffect(() => {
    if (!isPro) return;

    const toRequest = matchFilteredPrograms
      .filter((p) => !(p.id in aiRatings) && !requestedIds.current.has(p.id))
      .slice(0, AI_RATING_BATCH_SIZE);

    if (toRequest.length === 0) return;

    toRequest.forEach((p) => requestedIds.current.add(p.id));

    fetch('/api/ai/rate-program-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programIds: toRequest.map((p) => p.id) }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ratings) setAiRatings((prev) => ({ ...prev, ...data.ratings }));
      })
      .catch(() => {
        // Non-critical enhancement — the rule-based matchPercent badge already covers fit.
      });
  }, [isPro, matchFilteredPrograms, aiRatings]);

  const deadlineSoonCount = initialPrograms.filter((p) => {
    const days = daysUntil(p.deadline_end);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  function selectTab(tab: string) {
    setActiveTab(tab as TabValue);
    setCategory('전체');
    setRegion('전체');
  }

  function resetFilters() {
    setCategory('전체');
    setRegion('전체');
    setMinMatchPercent(0);
    setMinAiMatchPercent(0);
  }

  async function toggleSave(programId: string) {
    const supabase = createClient();
    const next = new Set(saved);

    if (next.has(programId)) {
      next.delete(programId);
      setSaved(next);
      await supabase.from('saved_programs').delete().eq('user_id', userId).eq('program_id', programId);
    } else {
      next.add(programId);
      setSaved(next);
      await supabase.from('saved_programs').insert({ user_id: userId, program_id: programId });
    }
  }

  const tabItems: PillTabItem[] = [
    { value: '전체', label: '전체', count: initialPrograms.length + initialEvents.length },
    { value: '지원사업', label: '지원사업', count: bucketPrograms.program.length },
    { value: '공모전', label: '공모전', count: bucketPrograms.contest.length },
    { value: '대출', label: '대출', count: bucketPrograms.loan.length },
    { value: '행사', label: '행사', count: initialEvents.length },
  ];

  const headingLabel = activeTab === '전체' ? '전체 지원사업' : activeTab;
  const bucketIsEmpty = activeTab !== '전체' && activeTab !== '행사' && tabSource.length === 0;
  const bucketEmptyCopy =
    activeTab !== '전체' && activeTab !== '행사' ? BUCKET_EMPTY_COPY[activeTab] : '';

  return (
    <div>
      <DashboardSummary
        matchedCount={initialPrograms.length}
        savedCount={saved.size}
        deadlineSoonCount={deadlineSoonCount}
      />

      <PillTabs items={tabItems} value={activeTab} onChange={selectTab} className="mb-lg" />

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-lg">
          {showFilters ? (
            <>
              <div className="flex flex-col gap-xs">
                <Label htmlFor="category-filter">카테고리</Label>
                <Select id="category-filter" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c === '전체' ? c : categoryLabel(c)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-xs">
                <Label htmlFor="region-filter">지역</Label>
                <Select id="region-filter" value={region} onChange={(e) => setRegion(e.target.value)}>
                  {regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-xs">
                <div className="flex items-center gap-xxs">
                  <Label htmlFor="match-filter">매칭도</Label>
                  <span className="inline-flex" title={MATCH_TOOLTIP} aria-label={MATCH_TOOLTIP}>
                    <Info className="h-3.5 w-3.5 shrink-0 text-stone" aria-hidden="true" />
                  </span>
                </div>
                <Select
                  id="match-filter"
                  value={minMatchPercent}
                  onChange={(e) => setMinMatchPercent(Number(e.target.value))}
                >
                  {MATCH_RATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </div>
              {isPro && (
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-xxs">
                    <Label htmlFor="ai-match-filter">AI 매칭도</Label>
                    <span className="inline-flex" title={AI_MATCH_TOOLTIP} aria-label={AI_MATCH_TOOLTIP}>
                      <Info className="h-3.5 w-3.5 shrink-0 text-stone" aria-hidden="true" />
                    </span>
                  </div>
                  <Select
                    id="ai-match-filter"
                    value={minAiMatchPercent}
                    onChange={(e) => setMinAiMatchPercent(Number(e.target.value))}
                  >
                    {MATCH_RATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                  {aiFilterPending && (
                    <p className="text-caption text-stone">
                      AI가 아직 분석 중인 항목이 있어요. 완료되는 대로 결과가 추가돼요.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-hairline p-md text-body-sm text-steel">
              행사에는 카테고리·지역·매칭도·AI 매칭도 필터가 적용되지 않아요.
            </p>
          )}
        </aside>

        <div>
          {activeTab === '행사' ? (
            <>
              <div className="mb-md flex items-center justify-between">
                <h2 className="text-card-title text-ink">다가오는 행사 {initialEvents.length}건</h2>
              </div>
              {initialEvents.length === 0 ? (
                <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-hairline p-xxl text-center">
                  <CalendarClock className="h-8 w-8 text-stone" aria-hidden="true" />
                  <p className="text-body-sm text-steel">
                    아직 등록된 행사가 없어요. 새로운 전시회·세미나·교육 정보가 올라오면 이곳에 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="grid gap-md sm:grid-cols-2">
                  {initialEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-md flex items-center justify-between">
                <h2 className="text-card-title text-ink">
                  매칭된 {headingLabel} {filteredPrograms.length}건
                </h2>
                {!isPro && <Badge>무료 플랜 — {freeLimit}건만 표시 중</Badge>}
              </div>

              {visiblePrograms.length === 0 ? (
                <ProgramEmptyState
                  isFiltered={isFiltered}
                  bucketIsEmpty={bucketIsEmpty}
                  bucketEmptyCopy={bucketEmptyCopy}
                  onReset={resetFilters}
                />
              ) : (
                <div className="grid gap-md sm:grid-cols-2">
                  {visiblePrograms.map((program) => (
                    <ProgramCard
                      key={program.id}
                      program={program}
                      saved={saved.has(program.id)}
                      onToggleSave={toggleSave}
                      showExplainButton={isPro}
                      matchScorePercent={matchPercent(program, profile)}
                      aiRating={aiRatings[program.id]}
                    />
                  ))}
                </div>
              )}

              {hiddenCount > 0 && (
                <div className="mt-xl flex flex-col items-center gap-sm rounded-lg border border-brand-blue-200 bg-brand-blue-200/20 p-lg text-center sm:flex-row sm:justify-between sm:text-left">
                  <p className="text-body-sm text-brand-blue-700">
                    {hiddenCount}건의 매칭 결과를 더 보려면 Pro로 업그레이드하세요.
                  </p>
                  <Link href={TOSS_ENABLED ? '/upgrade' : '/settings/billing'} className="shrink-0">
                    <Button size="sm">Pro로 업그레이드</Button>
                  </Link>
                </div>
              )}

              {activeTab === '전체' && initialEvents.length > 0 && (
                <div className="mt-xxl border-t border-hairline pt-xl">
                  <div className="mb-md flex items-center justify-between">
                    <h2 className="text-card-title text-ink">관련 행사 {initialEvents.length}건</h2>
                    <button
                      type="button"
                      onClick={() => selectTab('행사')}
                      className="text-body-sm-medium text-ink hover:underline"
                    >
                      전체 보기
                    </button>
                  </div>
                  <div className="grid gap-md sm:grid-cols-2">
                    {initialEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
