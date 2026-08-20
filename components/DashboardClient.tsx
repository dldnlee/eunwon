'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ProgramCard } from '@/components/ProgramCard';
import { DashboardSummary } from '@/components/DashboardSummary';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TOSS_ENABLED } from '@/lib/payments';
import { scoreMatch, MAX_MATCH_SCORE } from '@/lib/matching';
import { daysUntil } from '@/lib/utils';
import { SearchX } from 'lucide-react';
import type { Program, Profile } from '@/lib/types';

export function DashboardClient({
  userId,
  profile,
  initialPrograms,
  savedProgramIds,
  isPro,
  freeLimit,
}: {
  userId: string;
  profile: Profile;
  initialPrograms: Program[];
  savedProgramIds: string[];
  isPro: boolean;
  freeLimit: number;
}) {
  const [saved, setSaved] = useState<Set<string>>(new Set(savedProgramIds));
  const [category, setCategory] = useState('전체');
  const [region, setRegion] = useState('전체');

  const categories = useMemo(
    () => ['전체', ...Array.from(new Set(initialPrograms.map((p) => p.category).filter(Boolean)))] as string[],
    [initialPrograms]
  );
  const regions = useMemo(
    () => ['전체', ...Array.from(new Set(initialPrograms.flatMap((p) => p.region)))],
    [initialPrograms]
  );

  const filtered = initialPrograms.filter((p) => {
    if (category !== '전체' && p.category !== category) return false;
    if (region !== '전체' && !p.region.includes(region) && !p.is_nationwide) return false;
    return true;
  });

  const visible = isPro ? filtered : filtered.slice(0, freeLimit);
  const hiddenCount = isPro ? 0 : Math.max(0, filtered.length - freeLimit);
  const isFiltered = category !== '전체' || region !== '전체';

  const deadlineSoonCount = initialPrograms.filter((p) => {
    const days = daysUntil(p.deadline_end);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  function resetFilters() {
    setCategory('전체');
    setRegion('전체');
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

  return (
    <div>
      <DashboardSummary
        matchedCount={initialPrograms.length}
        savedCount={saved.size}
        deadlineSoonCount={deadlineSoonCount}
      />

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-lg">
          <div className="flex flex-col gap-xs">
            <Label htmlFor="category-filter">카테고리</Label>
            <Select id="category-filter" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
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
        </aside>

        <div>
          <div className="mb-md flex items-center justify-between">
            <h2 className="text-card-title text-ink">
              매칭된 지원사업 {filtered.length}건
            </h2>
            {!isPro && <Badge>무료 플랜 — {freeLimit}건만 표시 중</Badge>}
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-hairline p-xxl text-center">
              <SearchX className="h-8 w-8 text-stone" aria-hidden="true" />
              <p className="text-body-sm text-steel">
                조건에 맞는 지원사업이 없어요. 필터를 조정해보세요.
              </p>
              {isFiltered && (
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-xs">
                  필터 초기화
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-md sm:grid-cols-2">
              {visible.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  saved={saved.has(program.id)}
                  onToggleSave={toggleSave}
                  showExplainButton={isPro}
                  matchScorePercent={Math.round((scoreMatch(program, profile) / MAX_MATCH_SCORE) * 100)}
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
        </div>
      </div>
    </div>
  );
}
