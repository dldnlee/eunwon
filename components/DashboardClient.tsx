'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProgramCard } from '@/components/ProgramCard';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Program } from '@/lib/types';

export function DashboardClient({
  userId,
  initialPrograms,
  savedProgramIds,
  isPro,
  freeLimit,
}: {
  userId: string;
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
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
      <aside className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-filter">카테고리</Label>
          <Select id="category-filter" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="region-filter">지역</Label>
          <Select id="region-filter" value={region} onChange={(e) => setRegion(e.target.value)}>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>
      </aside>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            매칭된 지원사업 {filtered.length}건
          </h2>
          {!isPro && <Badge variant="secondary">무료 플랜 — {freeLimit}건만 표시 중</Badge>}
        </div>

        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            조건에 맞는 지원사업이 없어요. 필터를 조정해보세요.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                saved={saved.has(program.id)}
                onToggleSave={toggleSave}
                showExplainButton={isPro}
              />
            ))}
          </div>
        )}

        {hiddenCount > 0 && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-center text-sm text-blue-900">
            {hiddenCount}건의 매칭 결과를 더 보려면 Pro로 업그레이드하세요.
          </div>
        )}
      </div>
    </div>
  );
}
