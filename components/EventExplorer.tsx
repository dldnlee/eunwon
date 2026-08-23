'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EventCard } from '@/components/EventCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Event } from '@/lib/types';
import { Search, SearchX } from 'lucide-react';

type DiscoveryEvent = Event & { registration_url?: string | null; relevance_score?: number | null };

export function EventExplorer({ events, userId, savedEventIds }: { events: DiscoveryEvent[]; userId: string; savedEventIds: string[] }) {
  const [query, setQuery] = useState('');
  const [eventType, setEventType] = useState('전체');
  const [category, setCategory] = useState('전체');
  const [region, setRegion] = useState('전체');
  const [registration, setRegistration] = useState('전체');
  const [dateRange, setDateRange] = useState('전체');
  const [saved, setSaved] = useState(() => new Set(savedEventIds));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const options = useMemo(() => ({
    types: Array.from(new Set(events.map((e) => e.event_type).filter(Boolean))) as string[],
    categories: Array.from(new Set(events.map((e) => e.category).filter(Boolean))) as string[],
    regions: Array.from(new Set(events.flatMap((e) => e.region))).sort(),
  }), [events]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ko-KR');
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(); horizon.setDate(horizon.getDate() + Number(dateRange || 0));
    return events.filter((event) => {
      const searchable = `${event.title} ${event.description ?? ''} ${event.host_org ?? ''}`.toLocaleLowerCase('ko-KR');
      if (normalized && !searchable.includes(normalized)) return false;
      if (eventType !== '전체' && event.event_type !== eventType) return false;
      if (category !== '전체' && event.category !== category) return false;
      if (region !== '전체' && !event.is_nationwide && !event.region.includes(region)) return false;
      if (registration === '접수 중' && (!event.apply_end || event.apply_end < today)) return false;
      if (registration === '저장됨' && !saved.has(event.id)) return false;
      if (dateRange !== '전체' && (!event.event_start || new Date(event.event_start) > horizon)) return false;
      return true;
    }).sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0) || (a.event_start ?? '9999').localeCompare(b.event_start ?? '9999'));
  }, [events, query, eventType, category, region, registration, dateRange, saved]);
  const reset = () => { setQuery(''); setEventType('전체'); setCategory('전체'); setRegion('전체'); setRegistration('전체'); setDateRange('전체'); };
  async function toggleSaved(event: DiscoveryEvent) {
    setSavingId(event.id); setMessage('');
    const supabase = createClient();
    const removing = saved.has(event.id);
    const result = removing ? await supabase.from('saved_events').delete().eq('user_id', userId).eq('event_id', event.id) : await supabase.from('saved_events').insert({ user_id: userId, event_id: event.id });
    if (result.error) setMessage('저장 상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.');
    else {
      setSaved((current) => {
        const next = new Set(current);
        if (removing) next.delete(event.id);
        else next.add(event.id);
        return next;
      });
      setMessage(removing ? '저장을 취소했어요.' : '행사를 저장했어요.');
    }
    setSavingId(null);
  }
  return (
    <section className="flex flex-col gap-xl" aria-labelledby="events-heading">
      <div className="flex flex-col gap-xs"><h1 id="events-heading" className="text-heading-md text-ink max-sm:text-heading-sm">교육·세미나·전시 행사</h1><p className="max-w-2xl text-body-md text-steel">사업 프로필에 맞는 중소기업 행사를 추천순으로 살펴보고, 저장하거나 캘린더에 추가하세요.</p></div>
      <div className="rounded-xl border border-hairline bg-canvas p-lg">
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
          <div className="md:col-span-2 lg:col-span-3"><Label htmlFor="event-search">행사 검색</Label><div className="relative mt-xs"><Search className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-stone" aria-hidden="true" /><Input id="event-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="행사명, 주최기관으로 검색" className="pl-10" /></div></div>
          <Filter label="행사 유형" value={eventType} onChange={setEventType} options={options.types} />
          <Filter label="분야" value={category} onChange={setCategory} options={options.categories} />
          <Filter label="지역" value={region} onChange={setRegion} options={options.regions} />
          <Filter label="접수 상태" value={registration} onChange={setRegistration} options={['접수 중', '저장됨']} />
          <Filter label="개최 시기" value={dateRange} onChange={setDateRange} options={['7', '30', '90']} labels={{ '7': '7일 이내', '30': '30일 이내', '90': '90일 이내' }} />
        </div>
        <div className="mt-md flex items-center justify-between gap-md"><p className="text-body-sm text-steel" aria-live="polite">{filtered.length}개 행사</p><Button type="button" variant="ghost" size="sm" onClick={reset}>필터 초기화</Button></div>
      </div>
      {message && <p role="status" aria-live="polite" className={message.includes('못했어요') ? 'text-body-sm text-error' : 'text-body-sm text-success-text'}>{message}</p>}
      {filtered.length > 0 ? <div className="grid gap-lg md:grid-cols-2 lg:grid-cols-3">{filtered.map((event) => <EventCard key={event.id} event={event} isSaved={saved.has(event.id)} isSaving={savingId === event.id} onSaveToggle={toggleSaved} />)}</div> : <div className="flex min-h-52 flex-col items-center justify-center gap-sm rounded-xl border border-dashed border-hairline bg-canvas p-xxl text-center"><SearchX className="h-8 w-8 text-stone" aria-hidden="true" /><p className="text-body-md text-charcoal">조건에 맞는 행사가 없어요.</p><p className="text-body-sm text-steel">필터를 조정하면 더 많은 행사를 볼 수 있어요.</p><Button type="button" variant="outline" onClick={reset}>전체 행사 보기</Button></div>}
    </section>
  );
}

function Filter({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  const id = `event-filter-${label}`;
  return <div><Label htmlFor={id}>{label}</Label><Select id={id} className="mt-xs" value={value} onChange={(e) => onChange(e.target.value)}><option value="전체">전체</option>{options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}</Select></div>;
}
