import type { SupabaseClient } from '@supabase/supabase-js';
import type { Event, Profile } from '@/lib/types';
import { daysUntil } from './utils';

export interface RankedEvent { event: Event; relevanceScore: number; relevanceReasons: string[] }

function normalizedWords(value: string): string[] {
  return value.toLowerCase().split(/[^0-9a-zA-Z가-힣]+/).filter((word) => word.length >= 2);
}

export function rankEventForProfile(event: Event, profile: Profile): RankedEvent {
  let score = 0;
  const reasons: string[] = [];
  if (!event.is_nationwide && event.region.includes(profile.region)) {
    score += 30; reasons.push(`${profile.region} 지역 행사예요.`);
  } else if (event.is_nationwide || event.is_online) {
    score += 20; reasons.push(event.is_online ? '온라인으로 참여할 수 있어요.' : '전국 대상 행사예요.');
  }
  if (event.category && profile.interest_categories.includes(event.category)) {
    score += 25; reasons.push(`관심 분야인 ${event.category} 행사예요.`);
  }
  const eventWords = new Set(normalizedWords(`${event.title} ${event.description ?? ''} ${event.category ?? ''}`));
  const profileTerms = [profile.industry_name ?? '', ...profile.tech_domains, profile.current_challenges ?? '']
    .flatMap(normalizedWords);
  const overlaps = Array.from(new Set(profileTerms.filter((term) => eventWords.has(term))));
  if (overlaps.length > 0) {
    score += Math.min(30, overlaps.length * 10);
    reasons.push(`사업 분야와 관련된 ${overlaps.slice(0, 2).join('·')} 내용을 다뤄요.`);
  }
  const registrationDays = daysUntil(event.apply_end);
  if (registrationDays != null && registrationDays >= 0) {
    score += registrationDays <= 7 ? 15 : 10;
    reasons.push(registrationDays === 0 ? '오늘 신청이 마감돼요.' : `신청 마감까지 ${registrationDays}일 남았어요.`);
  }
  return { event, relevanceScore: Math.min(100, score), relevanceReasons: reasons.slice(0, 3) };
}

/**
 * Upcoming business-support events relevant to a profile — same region logic
 * as getMatchedPrograms() in lib/matching.ts (nationwide or region match),
 * but events have no entity_type/age eligibility to filter on.
 */
export async function getUpcomingEvents(
  supabase: SupabaseClient,
  profile: Profile,
  options: { limit?: number } = {}
): Promise<Event[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .or(`event_end.is.null,event_end.gte.${today}`)
    .or(`is_nationwide.eq.true,is_online.eq.true,region.cs.{"${profile.region}"}`)
    .order('event_start', { ascending: true, nullsFirst: false })
    .limit(options.limit ?? 50);

  if (error) throw error;
  return ((data ?? []) as Event[])
    .map((event) => rankEventForProfile(event, profile))
    .sort((a, b) => b.relevanceScore - a.relevanceScore ||
      new Date(a.event.event_start ?? '9999-12-31').getTime() - new Date(b.event.event_start ?? '9999-12-31').getTime())
    .map((ranked) => ranked.event);
}

export async function getRankedUpcomingEvents(
  supabase: SupabaseClient,
  profile: Profile,
  options: { limit?: number } = {}
): Promise<RankedEvent[]> {
  const events = await getUpcomingEvents(supabase, profile, options);
  return events.map((event) => rankEventForProfile(event, profile));
}
