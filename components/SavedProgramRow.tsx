'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { formatKoreanDate } from '@/lib/utils';
import type { Program, SavedStatus } from '@/lib/types';
import { CalendarClock, CalendarPlus, Check, X } from 'lucide-react';
import { PreparationChecklist } from '@/components/PreparationChecklist';

const STATUS_OPTIONS = ['considering', 'preparing', 'submitted', 'screening', 'interview', 'selected', 'rejected', 'withdrawn'] as const satisfies readonly SavedStatus[];
const STATUS_LABELS: Record<SavedStatus, string> = {
  considering: '검토 중', preparing: '신청 준비', submitted: '신청 완료', screening: '심사 중',
  interview: '면접 예정', selected: '선정', rejected: '미선정', withdrawn: '진행 중단',
};
const ACTIVE_STEPS = ['considering', 'preparing', 'submitted', 'screening', 'interview'] as const;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SavedProgramRow({ savedId, program, initialStatus, initialNotes, initialOutcome,
  initialReceivedAt, initialAmountKrw, initialSubmittedAt, initialNextAction, initialNextActionDueAt, initialHistory }: {
  savedId: string; program: Program; initialStatus: SavedStatus; initialNotes: string;
  initialOutcome: string; initialReceivedAt: string; initialAmountKrw: string;
  initialSubmittedAt: string; initialNextAction: string; initialNextActionDueAt: string;
  initialHistory: { fromStatus: SavedStatus; toStatus: SavedStatus; changedAt: string }[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SavedStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [outcome, setOutcome] = useState(initialOutcome);
  const [receivedAt, setReceivedAt] = useState(initialReceivedAt);
  const [amountKrw, setAmountKrw] = useState(initialAmountKrw);
  const [nextAction, setNextAction] = useState(initialNextAction);
  const [nextActionDueAt, setNextActionDueAt] = useState(initialNextActionDueAt);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [statusError, setStatusError] = useState('');
  const [removed, setRemoved] = useState(false);
  const terminal = status === 'selected' || status === 'rejected' || status === 'withdrawn';
  const showOutcomeFields = status === 'selected' || status === 'rejected';
  const activeStepIndex = ACTIVE_STEPS.indexOf(status as (typeof ACTIVE_STEPS)[number]);

  async function updateStatus(next: SavedStatus) {
    const previous = status;
    setStatus(next);
    setStatusError('');
    try {
      const response = await fetch(`/api/saved-programs/${savedId}/transition`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error('transition failed');
      router.refresh();
    } catch {
      setStatus(previous);
      setStatusError('상태를 변경하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  async function saveDetails() {
    setSaveState('saving');
    try {
      const response = await fetch(`/api/saved-programs/${savedId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, outcome, receivedAt: receivedAt || null,
          amountKrw: amountKrw ? Number(amountKrw) : null, nextAction, nextActionDueAt: nextActionDueAt || null }),
      });
      if (!response.ok) throw new Error('save failed');
      setSaveState('saved');
      router.refresh();
      setTimeout(() => setSaveState('idle'), 2000);
    } catch { setSaveState('error'); }
  }

  async function remove() {
    setRemoved(true);
    const supabase = createClient();
    const { error } = await supabase.from('saved_programs').delete().eq('id', savedId);
    if (error) { setRemoved(false); return; }
    router.refresh();
  }

  if (removed) return null;
  return (
    <Card className="rounded-xl">
      <CardContent className="flex flex-col gap-lg p-lg sm:p-xl">
        <div className="flex items-start justify-between gap-sm">
          <div className="min-w-0">
            <Link href={`/program/${program.id}`} className="rounded-sm text-card-title text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">{program.title}</Link>
            <p className="mt-xxs text-body-sm text-steel">{program.agency} · ~{formatKoreanDate(program.deadline_end)}</p>
          </div>
          <button type="button" onClick={remove} aria-label={`${program.title} 저장 목록에서 삭제`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone transition-colors hover:bg-surface hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 max-sm:h-11 max-sm:w-11"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>

        <section aria-labelledby={`progress-${savedId}`} className="flex flex-col gap-sm">
          <div className="flex items-end justify-between gap-md max-sm:flex-col max-sm:items-stretch">
            <div><h3 id={`progress-${savedId}`} className="text-caption-bold text-ink">신청 진행</h3><p className="text-caption text-steel">현재 단계를 바꾸면 진행 기록에 저장돼요.</p></div>
            <label className="flex min-w-40 flex-col gap-xxs text-caption text-steel">현재 상태
              <Select value={status} onChange={(event) => updateStatus(event.target.value as SavedStatus)} aria-describedby={statusError ? `status-error-${savedId}` : undefined}>
                {STATUS_OPTIONS.map((option) => <option key={option} value={option} disabled={terminal && option !== 'considering' && option !== status}>{STATUS_LABELS[option]}</option>)}
              </Select>
            </label>
          </div>
          <ol className="grid grid-cols-5 gap-xxs" aria-label="신청 진행 단계">
            {ACTIVE_STEPS.map((step, index) => { const complete = activeStepIndex >= 0 && index <= activeStepIndex; return (
              <li key={step} className="min-w-0"><span className={`block h-1 rounded-full ${complete ? 'bg-primary' : 'bg-hairline'}`} /><span className={`mt-xxs block truncate text-micro ${index === activeStepIndex ? 'font-semibold text-ink' : 'text-stone'}`}>{STATUS_LABELS[step]}</span></li>
            ); })}
          </ol>
          {statusError && <p id={`status-error-${savedId}`} role="alert" className="text-caption text-error">{statusError}</p>}
          {(initialSubmittedAt || initialHistory.length > 0) && (
            <details className="group rounded-lg border border-hairline px-md py-sm">
              <summary className="cursor-pointer rounded-sm text-body-sm-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
                진행 기록 {initialHistory.length > 0 && `(${initialHistory.length})`}
              </summary>
              <div className="mt-sm border-t border-hairline-soft pt-sm">
                {initialSubmittedAt && <p className="mb-xs text-caption text-steel">신청 완료일 · {formatKoreanDate(initialSubmittedAt)}</p>}
                <ol className="flex flex-col gap-xs">
                  {initialHistory.slice(0, 5).map((history, index) => (
                    <li key={`${history.changedAt}-${index}`} className="flex items-baseline justify-between gap-sm text-caption">
                      <span className="text-charcoal">{STATUS_LABELS[history.fromStatus]} → <strong className="font-semibold text-ink">{STATUS_LABELS[history.toStatus]}</strong></span>
                      <time dateTime={history.changedAt} className="shrink-0 text-stone">{formatKoreanDate(history.changedAt)}</time>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          )}
        </section>

        <section aria-labelledby={`next-action-${savedId}`} className="rounded-lg border border-hairline bg-surface p-md">
          <div className="mb-sm flex items-center justify-between gap-sm max-sm:items-start">
            <div className="flex min-h-9 items-center gap-xs"><CalendarClock className="h-4 w-4 text-ink" aria-hidden="true" /><h3 id={`next-action-${savedId}`} className="text-caption-bold text-ink">다음 할 일</h3></div>
            {program.deadline_end && (
              <a
                href={`/api/saved-programs/${savedId}/calendar`}
                download
                aria-label={`${program.title} 마감일 캘린더 파일 다운로드`}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-xxs rounded-full border border-hairline bg-canvas px-md text-caption-bold text-ink transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 max-sm:min-h-11"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                캘린더에 추가
              </a>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_11rem] gap-sm max-sm:grid-cols-1">
            <label className="flex flex-col gap-xxs text-caption text-steel">할 일<Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="예: 사업계획서 초안 작성" /></label>
            <label className="flex flex-col gap-xxs text-caption text-steel">목표일<Input type="date" value={nextActionDueAt} onChange={(event) => setNextActionDueAt(event.target.value)} /></label>
          </div>
        </section>

        <PreparationChecklist savedId={savedId} />

        {showOutcomeFields && <section aria-label="신청 결과" className="grid grid-cols-2 gap-sm rounded-lg border border-hairline bg-surface p-md max-sm:grid-cols-1">
          <label className="flex flex-col gap-xxs text-caption text-steel">{status === 'selected' ? '선정일' : '결과 확인일'}<Input type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} /></label>
          {status === 'selected' && <label className="flex flex-col gap-xxs text-caption text-steel">지원받은 금액 (원)<Input type="number" min={0} value={amountKrw} onChange={(event) => setAmountKrw(event.target.value)} /></label>}
          <label className="col-span-2 flex flex-col gap-xxs text-caption text-steel max-sm:col-span-1">결과 메모<Input value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="예: 서류 통과, 최종 선정 등" /></label>
        </section>}

        <section className="flex flex-col gap-xs"><label className="text-caption-bold text-ink" htmlFor={`notes-${savedId}`}>메모</label><Textarea id={`notes-${savedId}`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="준비하면서 기억할 내용을 남겨보세요" /></section>
        <div className="flex items-center justify-end gap-sm max-sm:flex-col-reverse max-sm:items-stretch">
          <p className={`text-caption ${saveState === 'error' ? 'text-error' : 'text-success-text'}`} role="status" aria-live="polite">
            {saveState === 'saved' && <span className="inline-flex items-center gap-xxs"><Check className="h-4 w-4" aria-hidden="true" />변경사항을 저장했어요.</span>}{saveState === 'error' && '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'}
          </p>
          <Button type="button" onClick={saveDetails} disabled={saveState === 'saving'} className="max-sm:w-full">{saveState === 'saving' ? '저장 중…' : '변경사항 저장'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
