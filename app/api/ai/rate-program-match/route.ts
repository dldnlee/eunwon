import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateProgramMatches } from '@/lib/ai/rateProgramMatch';
import { isProUser } from '@/lib/trial';
import type { Profile } from '@/lib/types';

const MAX_PROGRAMS_PER_REQUEST = 30;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const { programIds } = await request.json();
  if (!Array.isArray(programIds) || programIds.length === 0) {
    return NextResponse.json({ error: 'programIds가 필요합니다' }, { status: 400 });
  }

  const cleanedIds = programIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_PROGRAMS_PER_REQUEST);
  if (cleanedIds.length === 0) {
    return NextResponse.json({ error: '유효한 programIds가 없습니다' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !isProUser(profile.subscription, user.created_at)) {
    return NextResponse.json({ error: 'Pro 플랜이 필요합니다' }, { status: 403 });
  }

  // Cached ratings persist per (user, program) — see migration 010. A rating is stale (and gets
  // recomputed) if the profile changed since it was rated; we deliberately don't key staleness
  // off the program's own updated_at, since syncPrograms.ts bumps that on every nightly sync
  // whether or not the program's actual content changed, which would invalidate the cache daily
  // for no reason.
  const { data: cachedRows } = await supabase
    .from('ai_program_ratings')
    .select('program_id, match_rate, reason, rated_at')
    .eq('user_id', user.id)
    .in('program_id', cleanedIds);

  const ratings: Record<string, { matchRate: number; reason: string }> = {};
  const staleOrMissingIds: string[] = [];

  const profileUpdatedAt = new Date(profile.updated_at).getTime();

  for (const id of cleanedIds) {
    const cached = cachedRows?.find((row) => row.program_id === id);
    if (cached && new Date(cached.rated_at).getTime() >= profileUpdatedAt) {
      ratings[id] = { matchRate: cached.match_rate, reason: cached.reason ?? '' };
    } else {
      staleOrMissingIds.push(id);
    }
  }

  if (staleOrMissingIds.length === 0) {
    return NextResponse.json({ ratings });
  }

  // Re-fetch title/description server-side by id rather than trusting whatever text the client
  // sends — same pattern as /api/ai/explain and /api/ai/generate-document.
  const { data: programs } = await supabase
    .from('programs')
    .select('id, title, description')
    .in('id', staleOrMissingIds);

  if (!programs || programs.length === 0) {
    // Nothing fresh to rate, but still return whatever was cached above.
    return NextResponse.json({ ratings });
  }

  try {
    const freshRatings = await rateProgramMatches(programs, profile as Profile);

    const upsertRows = Object.entries(freshRatings).map(([programId, rating]) => ({
      user_id: user.id,
      program_id: programId,
      match_rate: rating.matchRate,
      reason: rating.reason,
      rated_at: new Date().toISOString(),
    }));

    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('ai_program_ratings')
        .upsert(upsertRows, { onConflict: 'user_id,program_id' });

      if (upsertError) {
        console.error('Failed to cache AI program ratings:', upsertError.message);
      }
    }

    return NextResponse.json({ ratings: { ...ratings, ...freshRatings } });
  } catch (err) {
    console.error('rateProgramMatches failed:', err);
    // Fall back to whatever was cached rather than failing the whole request.
    return NextResponse.json({ ratings });
  }
}
