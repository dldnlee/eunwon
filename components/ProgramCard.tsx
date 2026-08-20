import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, daysUntil, formatAmount, formatKoreanDate } from '@/lib/utils';
import type { Program } from '@/lib/types';
import { Bookmark } from 'lucide-react';

function DeadlineBadge({ deadlineEnd }: { deadlineEnd: string | null }) {
  const days = daysUntil(deadlineEnd);
  if (days === null) return <Badge>상시모집</Badge>;
  if (days < 0) return <Badge>마감</Badge>;
  if (days <= 7) return <Badge variant="destructive">마감임박 D-{days}</Badge>;
  if (days <= 30) return <Badge variant="warning">D-{days}</Badge>;
  return <Badge>D-{days}</Badge>;
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
    <Card className="flex flex-col hover:shadow-subtle">
      <CardHeader>
        <div className="flex items-start justify-between gap-xs">
          <div className="flex flex-wrap gap-xs">
            {program.category && <Badge variant="outline">{program.category}</Badge>}
            <DeadlineBadge deadlineEnd={program.deadline_end} />
          </div>
          <button
            type="button"
            aria-label={saved ? '북마크 해제' : '북마크'}
            aria-pressed={saved}
            onClick={() => onToggleSave?.(program.id)}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors max-sm:h-11 max-sm:w-11',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
              saved ? 'text-success-text hover:bg-success-bg' : 'text-stone hover:bg-surface hover:text-ink'
            )}
          >
            <Bookmark className={saved ? 'h-5 w-5 fill-success-text' : 'h-5 w-5'} />
          </button>
        </div>
        <CardTitle className="line-clamp-2">
          <Link
            href={`/program/${program.id}`}
            className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
          >
            {program.title}
          </Link>
        </CardTitle>
        <CardDescription>{program.agency}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-sm">
        {program.ai_summary && (
          <p className="line-clamp-2 text-body-sm text-charcoal">{program.ai_summary}</p>
        )}
        <div className="mt-auto flex items-center justify-between text-body-sm">
          <span className="font-semibold text-ink">
            {formatAmount(program.amount_text, program.amount_max)}
          </span>
          <span className="text-stone">~{formatKoreanDate(program.deadline_end)}</span>
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
