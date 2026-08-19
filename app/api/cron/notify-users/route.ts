import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { getMatchedPrograms } from '@/lib/matching';
import type { Profile, Program } from '@/lib/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

function buildEmailHtml(programs: Program[]): string {
  const rows = programs
    .map(
      (p) => `<li><strong>${p.title}</strong> — ${p.agency}<br/>${p.ai_summary ?? ''}</li>`
    )
    .join('');
  return `<h2>새로운 지원사업이 매칭됐어요</h2><ul>${rows}</ul>`;
}

/**
 * Daily job (see vercel.json): for each user with email alerts enabled, find
 * matches not yet notified about, email a summary, and record what was sent
 * so the same program is never emailed twice.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('notify_email', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let usersNotified = 0;

  for (const profile of (profiles ?? []) as Profile[]) {
    const matched = await getMatchedPrograms(supabase, profile, { limit: 50 });
    if (matched.length === 0) continue;

    const { data: alreadyNotified } = await supabase
      .from('notifications')
      .select('program_id')
      .eq('user_id', profile.id)
      .in('program_id', matched.map((p) => p.id));

    const seenIds = new Set((alreadyNotified ?? []).map((n) => n.program_id));
    const fresh = matched.filter((p) => !seenIds.has(p.id));
    if (fresh.length === 0) continue;

    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email;
    if (!email) continue;

    try {
      await resend.emails.send({
        from: '지원사업매칭 <alerts@eunwon.com>',
        to: email,
        subject: `새로운 지원사업 ${fresh.length}건이 매칭됐어요`,
        html: buildEmailHtml(fresh),
      });

      await supabase
        .from('notifications')
        .insert(fresh.map((p) => ({ user_id: profile.id, program_id: p.id })));

      usersNotified++;
    } catch (err) {
      console.error(`Failed to email profile ${profile.id}:`, err);
    }
  }

  return NextResponse.json({ usersNotified });
}
