'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { formatKoreanDate } from '@/lib/utils';
import type { Program, SavedStatus } from '@/lib/types';
import { X } from 'lucide-react';

const STATUS_OPTIONS: SavedStatus[] = ['관심', '신청중', '완료'];

export function SavedProgramRow({
  savedId,
  program,
  initialStatus,
  initialNotes,
}: {
  savedId: string;
  program: Program;
  initialStatus: SavedStatus;
  initialNotes: string;
}) {
  const [status, setStatus] = useState<SavedStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [notesSaved, setNotesSaved] = useState(false);
  const [removed, setRemoved] = useState(false);

  async function updateStatus(next: SavedStatus) {
    setStatus(next);
    const supabase = createClient();
    await supabase.from('saved_programs').update({ status: next }).eq('id', savedId);
  }

  async function saveNotes() {
    const supabase = createClient();
    await supabase.from('saved_programs').update({ notes }).eq('id', savedId);
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
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div className="flex gap-xs">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="메모를 남겨보세요"
            className="min-h-[60px]"
          />
          <div className="flex flex-col items-center gap-xxs self-start">
            <Button variant="outline" size="sm" onClick={saveNotes}>
              저장
            </Button>
            {notesSaved && <span className="text-caption text-success-text">저장됨</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
