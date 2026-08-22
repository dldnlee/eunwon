import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { daysUntil, formatKoreanDate } from '@/lib/utils';
import type { Event } from '@/lib/types';
import { ExternalLink } from 'lucide-react';

/** Mirrors ProgramCard's DeadlineBadge, but keyed off event start/end rather than an application deadline. */
function EventDateBadge({ eventStart, eventEnd }: { eventStart: string | null; eventEnd: string | null }) {
  const startDays = daysUntil(eventStart);

  if (startDays === null) return <Badge>일정 미정</Badge>;

  if (startDays > 0) {
    if (startDays <= 7) return <Badge variant="destructive">시작 D-{startDays}</Badge>;
    if (startDays <= 30) return <Badge variant="warning">D-{startDays}</Badge>;
    return <Badge>D-{startDays}</Badge>;
  }

  if (startDays === 0) return <Badge variant="destructive">오늘 시작</Badge>;

  // Already started — check whether it's still running.
  const endDays = daysUntil(eventEnd);
  if (endDays === null || endDays >= 0) return <Badge variant="success">진행 중</Badge>;
  return <Badge variant="secondary">종료</Badge>;
}

export function EventCard({ event }: { event: Event }) {
  const dateRange =
    event.event_start || event.event_end
      ? `${formatKoreanDate(event.event_start)} ~ ${formatKoreanDate(event.event_end)}`
      : '일정 미정';

  const titleClassName =
    'rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2';

  return (
    <Card className="flex flex-col hover:shadow-subtle">
      <CardHeader>
        <div className="flex flex-wrap gap-xs">
          {event.event_type && <Badge variant="outline">{event.event_type}</Badge>}
          {event.category && <Badge variant="secondary">{event.category}</Badge>}
          <EventDateBadge eventStart={event.event_start} eventEnd={event.event_end} />
        </div>
        <CardTitle className="line-clamp-2">
          {event.detail_url ? (
            <a href={event.detail_url} target="_blank" rel="noopener noreferrer" className={titleClassName}>
              {event.title}
            </a>
          ) : (
            <span className={titleClassName}>{event.title}</span>
          )}
        </CardTitle>
        {event.host_org && <CardDescription>{event.host_org}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-sm">
        {event.description && (
          <p className="line-clamp-2 text-body-sm text-charcoal">{event.description}</p>
        )}
        <div className="mt-auto flex items-center justify-end text-body-sm">
          <span className="text-stone">{dateRange}</span>
        </div>
      </CardContent>
      <CardFooter>
        {event.detail_url ? (
          <a href={event.detail_url} target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="outline" className="w-full">
              자세히 보기
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Button>
          </a>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            상세 정보 준비 중
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
