import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { buildEventIcs } from '@/lib/events/ics';
import type { Event } from '@/lib/types';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: '올바르지 않은 행사입니다.' }, { status: 400 });
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data: saved } = await supabase.from('saved_events')
    .select('event:events(*)').eq('user_id', user.id).eq('event_id', params.id).maybeSingle();
  const event = saved?.event as unknown as Event | null;
  if (!event) return NextResponse.json({ error: '저장한 행사를 찾을 수 없습니다.' }, { status: 404 });
  if (!event.event_start) return NextResponse.json({ error: '일정이 확정되지 않은 행사입니다.' }, { status: 409 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eunwon.com';
  const canonicalUrl = new URL(`/events?event=${event.id}`, appUrl).toString();
  const body = buildEventIcs(event, canonicalUrl);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="eunwon-event-${event.id}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
