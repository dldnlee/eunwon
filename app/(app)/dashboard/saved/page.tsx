import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SavedProgramRow } from '@/components/SavedProgramRow';
import { Bookmark } from 'lucide-react';
import type { Program, SavedStatus } from '@/lib/types';

export default async function SavedProgramsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rows } = await supabase
    .from('saved_programs')
    .select('id, status, notes, outcome, received_at, amount_krw, submitted_at, next_action, next_action_due_at, program:programs(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const saved = (rows ?? []) as unknown as {
    id: string;
    status: SavedStatus;
    notes: string | null;
    outcome: string | null;
    received_at: string | null;
    amount_krw: number | null;
    submitted_at: string | null;
    next_action: string | null;
    next_action_due_at: string | null;
    program: Program;
  }[];

  const savedIds = saved.map((row) => row.id);
  const { data: historyRows } = savedIds.length > 0
    ? await supabase
        .from('saved_program_status_history')
        .select('saved_program_id, from_status, to_status, changed_at')
        .in('saved_program_id', savedIds)
        .order('changed_at', { ascending: false })
    : { data: [] };
  const historyBySavedId = new Map<string, { fromStatus: SavedStatus; toStatus: SavedStatus; changedAt: string }[]>();
  for (const history of historyRows ?? []) {
    const current = historyBySavedId.get(history.saved_program_id) ?? [];
    current.push({
      fromStatus: history.from_status as SavedStatus,
      toStatus: history.to_status as SavedStatus,
      changedAt: history.changed_at,
    });
    historyBySavedId.set(history.saved_program_id, current);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-xl text-heading-sm text-ink">저장한 지원사업</h1>
      {saved.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-hairline p-xxl text-center">
          <Bookmark className="h-8 w-8 text-stone" aria-hidden="true" />
          <p className="text-body-sm text-steel">
            아직 저장한 지원사업이 없어요. 대시보드에서 관심있는 사업을 북마크해보세요.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {saved.map((row) => (
            <SavedProgramRow
              key={row.id}
              savedId={row.id}
              program={row.program}
              initialStatus={row.status}
              initialNotes={row.notes ?? ''}
              initialOutcome={row.outcome ?? ''}
              initialReceivedAt={row.received_at ?? ''}
              initialAmountKrw={row.amount_krw != null ? String(row.amount_krw) : ''}
              initialSubmittedAt={row.submitted_at ?? ''}
              initialNextAction={row.next_action ?? ''}
              initialNextActionDueAt={row.next_action_due_at ?? ''}
              initialHistory={historyBySavedId.get(row.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
