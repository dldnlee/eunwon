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
  const [removed, setRemoved] = useState(false);

  async function updateStatus(next: SavedStatus) {
    setStatus(next);
    const supabase = createClient();
    await supabase.from('saved_programs').update({ status: next }).eq('id', savedId);
  }

  async function saveNotes() {
    const supabase = createClient();
    await supabase.from('saved_programs').update({ notes }).eq('id', savedId);
  }

  async function remove() {
    setRemoved(true);
    const supabase = createClient();
    await supabase.from('saved_programs').delete().eq('id', savedId);
  }

  if (removed) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/program/${program.id}`} className="font-semibold text-slate-900 hover:underline">
              {program.title}
            </Link>
            <p className="text-sm text-slate-500">
              {program.agency} · ~{formatKoreanDate(program.deadline_end)}
            </p>
          </div>
          <button onClick={remove} aria-label="삭제" className="text-slate-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
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
        <div className="flex gap-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="메모를 남겨보세요"
            className="min-h-[60px]"
          />
          <Button variant="outline" size="sm" onClick={saveNotes} className="self-start">
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
