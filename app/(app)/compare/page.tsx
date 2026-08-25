import { redirect } from 'next/navigation';
import { ProgramComparison } from '@/components/ProgramComparison';
import { createClient } from '@/lib/supabase/server';
import { loadEligibilityGapAnalysis } from '@/lib/eligibility/load-gap-analysis';
import { calculateMatchConfidence } from '@/lib/match-confidence';
import {
  buildProgramComparisonItem,
  parseComparisonIds,
} from '@/lib/program-comparison';
import type { Profile, Program, SavedProgram } from '@/lib/types';

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { ids?: string | string[] };
}) {
  const ids = parseComparisonIds(searchParams.ids);
  if (ids.length < 2) redirect('/dashboard');

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/compare?ids=${ids.join(',')}`)}`);

  const [profileResult, programsResult, savedResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('programs').select('*').in('id', ids).eq('is_active', true),
    supabase.from('saved_programs')
      .select('id,program_id,status,next_action,next_action_due_at')
      .eq('user_id', user.id).in('program_id', ids),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (programsResult.error) throw programsResult.error;
  if (savedResult.error) throw savedResult.error;
  const profile = profileResult.data;
  const programRows = programsResult.data;
  const savedRows = savedResult.data;
  if (!profile) redirect('/onboard');

  const programsById = new Map(((programRows ?? []) as Program[]).map((program) => [program.id, program]));
  const programs = ids.map((id) => programsById.get(id)).filter((program): program is Program => Boolean(program));
  if (programs.length < 2) redirect('/dashboard');

  const saved = (savedRows ?? []) as Pick<SavedProgram, 'id' | 'program_id' | 'status' | 'next_action' | 'next_action_due_at'>[];
  const savedByProgram = new Map(saved.map((row) => [row.program_id, row]));
  const savedIds = saved.map((row) => row.id);
  const { data: checklistRows, error: checklistError } = savedIds.length > 0
    ? await supabase.from('saved_program_checklist_items')
        .select('saved_program_id,completed').eq('user_id', user.id).in('saved_program_id', savedIds)
    : { data: null, error: null };
  if (checklistError) throw checklistError;
  const checklistBySaved = new Map<string, { completed: number; total: number }>();
  for (const row of checklistRows ?? []) {
    const current = checklistBySaved.get(row.saved_program_id) ?? { completed: 0, total: 0 };
    current.total += 1;
    if (row.completed) current.completed += 1;
    checklistBySaved.set(row.saved_program_id, current);
  }

  const items = await Promise.all(programs.map(async (program) => {
    const { extractionRun, analysis } = await loadEligibilityGapAnalysis(
      supabase, program.id, profile as Profile
    );
    const confidence = calculateMatchConfidence({
      analysis,
      profileUpdatedAt: profile.updated_at,
      programUpdatedAt: program.updated_at,
      extractionRunId: extractionRun?.id ?? null,
      extractionFingerprint: extractionRun?.source_fingerprint ?? null,
      extractionCompletedAt: extractionRun?.completed_at ?? null,
    });
    const savedProgram = savedByProgram.get(program.id) ?? null;
    return buildProgramComparisonItem({
      program,
      gaps: analysis,
      confidence,
      checklist: savedProgram ? checklistBySaved.get(savedProgram.id) ?? null : null,
      saved: savedProgram,
    });
  }));

  return <ProgramComparison items={items} />;
}
