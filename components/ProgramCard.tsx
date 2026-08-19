import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { daysUntil, formatAmount, formatKoreanDate } from '@/lib/utils';
import type { Program } from '@/lib/types';
import { Bookmark } from 'lucide-react';

function DeadlineBadge({ deadlineEnd }: { deadlineEnd: string | null }) {
  const days = daysUntil(deadlineEnd);
  if (days === null) return <Badge variant="secondary">상시모집</Badge>;
  if (days < 0) return <Badge variant="secondary">마감</Badge>;
  if (days <= 7) return <Badge variant="destructive">마감임박 D-{days}</Badge>;
  if (days <= 30) return <Badge variant="warning">D-{days}</Badge>;
  return <Badge variant="secondary">D-{days}</Badge>;
}

export function ProgramCard({
  program,
  saved = false,
  onToggleSave,
  showExplainButton = false,
}: {
  program: Program;
  saved?: boolean;
  onToggleSave?: (programId: string) => void;
  showExplainButton?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {program.category && <Badge variant="outline">{program.category}</Badge>}
            <DeadlineBadge deadlineEnd={program.deadline_end} />
          </div>
          <button
            type="button"
            aria-label="북마크"
            onClick={() => onToggleSave?.(program.id)}
            className="text-slate-400 hover:text-blue-600"
          >
            <Bookmark className={saved ? 'h-5 w-5 fill-blue-600 text-blue-600' : 'h-5 w-5'} />
          </button>
        </div>
        <CardTitle className="line-clamp-2">
          <Link href={`/program/${program.id}`} className="hover:underline">
            {program.title}
          </Link>
        </CardTitle>
        <CardDescription>{program.agency}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {program.ai_summary && (
          <p className="line-clamp-2 text-sm text-slate-600">{program.ai_summary}</p>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-900">
            {formatAmount(program.amount_text, program.amount_max)}
          </span>
          <span className="text-slate-400">~{formatKoreanDate(program.deadline_end)}</span>
        </div>
      </CardContent>
      <CardFooter>
        <Link href={`/program/${program.id}`} className="w-full">
          <Button variant="outline" className="w-full">자세히 보기</Button>
        </Link>
        {showExplainButton && (
          <Link href={`/program/${program.id}#explain`} className="w-full">
            <Button className="w-full">왜 나에게 맞나요?</Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
