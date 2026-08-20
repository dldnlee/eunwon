'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { formatKoreanDate } from '@/lib/utils';
import type { Program, SavedStatus } from '@/lib/types';
import { X } from 'lucide-react';

const STATUS_LABELS: Record<SavedStatus, string> = {
  saved: '저장됨',
  applied: '신청함',
  selected: '선정됨',
  rejected: '탈락',
};
const STATUS_OPTIONS: SavedStatus[] = ['saved', 'applied', 'selected', 'rejected'];

export function SavedProgramRow({
  savedId,
  program,
  initialStatus,
  initialNotes,
  initialOutcome,
  initialReceivedAt,
  initialAmountKrw,
}: {
  savedId: string;
  program: Program;
  initialStatus: SavedStatus;
  initialNotes: string;
  initialOutcome: string;
  initialReceivedAt: string;
  initialAmountKrw: string;
}) {
  const [status, setStatus] = useState<SavedStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [outcome, setOutcome] = useState(initialOutcome);
  const [receivedAt, setReceivedAt] = useState(initialReceivedAt);
  const [amountKrw, setAmountKrw] = useState(initialAmountKrw);
  const [notesSaved, setNotesSaved] = useState(false);
  const [removed, setRemoved] = useState(false);

  const showOutcomeFields = status === 'selected' || status === 'rejected';

  async function updateStatus(next: SavedStatus) {
    setStatus(next);
    const supabase = createClient();
    await supabase.from('saved_programs').update({ status: next }).eq('id', savedId);
  }

  async function saveDetails() {
    const supabase = createClient();
    await supabase
      .from('saved_programs')
      .update({
        notes,
        outcome: outcome || null,
        received_at: receivedAt || null,
        amount_krw: amountKrw ? Number(amountKrw) : null,
      })
      .eq('id', savedId);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  async function remove() {
    setRemoved(true);
    const supabase = createClient();
    await supabase.from('saved_programs').delete().eq('id', savedId);
  }

  if (removed) return null;

  return (
    <Card className="rounded-lg">
      <CardContent className="flex flex-col gap-sm p-lg">
        <div className="flex items-start justify-between gap-xs">
          <div>
            <Link
              href={`/program/${program.id}`}
              className="rounded-sm font-semibold text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
            >
              {program.title}
            </Link>
            <p className="text-body-sm text-steel">
              {program.agency} · ~{formatKoreanDate(program.deadline_end)}
            </p>
          </div>
          <button
            onClick={remove}
            aria-label="삭제"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone transition-colors hover:bg-surface hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 max-sm:h-11 max-sm:w-11"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-sm">
          <Select
            value={status}
            onChange={(e) => updateStatus(e.target.value as SavedStatus)}
            className="w-32"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>

        {showOutcomeFields && (
          <div className="grid grid-cols-2 gap-sm rounded-md bg-surface p-md">
            <div className="flex flex-col gap-xxs">
              <label className="text-caption text-steel">
                {status === 'selected' ? '선정일' : '결과 확인일'}
              </label>
              <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
            </div>
            {status === 'selected' && (
              <div className="flex flex-col gap-xxs">
                <label className="text-caption text-steel">지원받은 금액 (원)</label>
                <Input
                  type="number"
                  min={0}
                  value={amountKrw}
                  onChange={(e) => setAmountKrw(e.target.value)}
                />
              </div>
            )}
            <div className="col-span-2 flex flex-col gap-xxs">
              <label className="text-caption text-steel">결과 메모</label>
              <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="예: 서류 통과, 최종 선정 등" />
            </div>
          </div>
        )}

        <div className="flex gap-xs">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="메모를 남겨보세요"
            className="min-h-[60px]"
          />
          <div className="flex flex-col items-center gap-xxs self-start">
            <Button variant="outline" size="sm" onClick={saveDetails}>
              저장
            </Button>
            {notesSaved && <span className="text-caption text-success-text">저장됨</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
