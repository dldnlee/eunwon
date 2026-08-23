import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { daysUntil, formatKoreanDate } from '@/lib/utils';
import type { Event } from '@/lib/types';
import { Bookmark, CalendarPlus, ExternalLink, MapPin, Video } from 'lucide-react';

type DiscoveryEvent = Event & { registration_url?: string | null; location_name?: string | null; is_online?: boolean; relevance_score?: number | null; relevance_reasons?: string[] | null };

function EventDateBadge({ eventStart, eventEnd }: { eventStart: string | null; eventEnd: string | null }) {
  const startDays = daysUntil(eventStart);
  if (startDays === null) return <Badge>일정 미정</Badge>;
  if (startDays > 0) {
    if (startDays <= 7) return <Badge variant="destructive">시작 D-{startDays}</Badge>;
    if (startDays <= 30) return <Badge variant="warning">D-{startDays}</Badge>;
    return <Badge>D-{startDays}</Badge>;
  }
  if (startDays === 0) return <Badge variant="destructive">오늘 시작</Badge>;
  const endDays = daysUntil(eventEnd);
  if (endDays === null || endDays >= 0) return <Badge variant="success">진행 중</Badge>;
  return <Badge variant="secondary">종료</Badge>;
}

export function EventCard({ event, isSaved = false, isSaving = false, onSaveToggle }: { event: DiscoveryEvent; isSaved?: boolean; isSaving?: boolean; onSaveToggle?: (event: DiscoveryEvent) => void }) {
  const dateRange = event.event_start || event.event_end ? `${formatKoreanDate(event.event_start)} ~ ${formatKoreanDate(event.event_end)}` : '일정 미정';
  const sourceUrl = event.registration_url || event.detail_url;
  const location = [event.is_online ? '온라인' : null, event.location_name, ...event.region].filter(Boolean).join(' · ');
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-subtle">
      <CardHeader className="gap-sm">
        <div className="flex flex-wrap gap-xs">
          {event.event_type && <Badge variant="outline">{event.event_type}</Badge>}
          {event.category && <Badge variant="secondary">{event.category}</Badge>}
          <EventDateBadge eventStart={event.event_start} eventEnd={event.event_end} />
          {typeof event.relevance_score === 'number' && event.relevance_score > 0 && <Badge variant="success">추천 {event.relevance_score}%</Badge>}
        </div>
        <CardTitle className="line-clamp-2">{event.title}</CardTitle>
        {event.host_org && <CardDescription>{event.host_org}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-sm">
        {event.description && <p className="line-clamp-2 text-body-sm text-charcoal">{event.description}</p>}
        {event.relevance_reasons && event.relevance_reasons.length > 0 && <p className="text-caption text-success-text">내 프로필과 맞는 이유: {event.relevance_reasons.slice(0, 2).join(' · ')}</p>}
        <dl className="mt-auto grid gap-xs text-body-sm text-steel">
          <div className="flex gap-xs"><dt className="sr-only">행사 일정</dt><CalendarPlus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><dd>{dateRange}</dd></div>
          {location && <div className="flex gap-xs"><dt className="sr-only">행사 장소</dt>{event.is_online ? <Video className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}<dd className="line-clamp-1">{location}</dd></div>}
        </dl>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-xs">
        {onSaveToggle && <Button type="button" variant={isSaved ? 'success' : 'secondary'} onClick={() => onSaveToggle(event)} disabled={isSaving} aria-pressed={isSaved} aria-label={`${event.title} ${isSaved ? '저장 취소' : '저장'}`} className="flex-1"><Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />{isSaving ? '처리 중' : isSaved ? '저장됨' : '저장'}</Button>}
        {isSaved && <a href={`/api/events/${event.id}/calendar`} download className="inline-flex min-h-10 flex-1 items-center justify-center gap-xs rounded-full border border-hairline bg-canvas px-lg text-button-md text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 max-sm:min-h-11" aria-label={`${event.title} 일정 파일 받기`}><CalendarPlus className="h-4 w-4" aria-hidden="true" />일정 추가</a>}
        {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 w-full items-center justify-center gap-xs rounded-full bg-primary px-xl text-button-md text-on-primary hover:bg-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 max-sm:min-h-11">{event.registration_url ? '신청 페이지' : '자세히 보기'}<ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : <Button variant="outline" className="w-full" disabled>상세 정보 준비 중</Button>}
      </CardFooter>
    </Card>
  );
}
