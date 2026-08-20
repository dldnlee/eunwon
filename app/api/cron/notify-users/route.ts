import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { getMatchedPrograms } from '@/lib/matching';
import { daysUntil } from '@/lib/utils';
import type { NotificationType, Profile, Program } from '@/lib/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

function buildNewMatchEmailHtml(programs: Program[]): string {
  const rows = programs
    .map((p) => `<li><strong>${p.title}</strong> — ${p.agency}<br/>${p.ai_summary ?? ''}</li>`)
    .join('');
  return `<h2>새로운 지원사업이 매칭됐어요</h2><ul>${rows}</ul>`;
}

function buildDeadlineEmailHtml(program: Program, daysLeft: number): string {
  return `<h2>[마감 ${daysLeft}일] ${program.title}</h2><p>${program.agency} · 저장하신 지원사업의 마감이 다가오고 있어요.</p><p>${program.ai_summary ?? ''}</p>`;
}

/** Highest daysUntil() value this cron ever fires a deadline alert for. */
const DEADLINE_MILESTONES: { days: number; type: NotificationType }[] = [
  { days: 7, type: 'deadline_7d' },
  { days: 3, type: 'deadline_3d' },
  { days: 1, type: 'deadline_1d' },
];

/**
 * Daily job (see vercel.json), Pro-only per the freemium model: for each Pro
 * user with notify_email = true —
 *   1. email newly-matched programs not seen before (type: new_match)
 *   2. email 7/3/1-day deadline warnings for their saved programs
 * `notification_log`'s unique(user_id, program_id, type) constraint is what
 * makes both idempotent across daily re-runs.
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
    .eq('notify_email', true)
    .eq('subscription', 'pro');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let usersNotified = 0;
  let deadlineAlertsSent = 0;

  for (const profile of (profiles ?? []) as Profile[]) {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email;
    if (!email) continue;

    // ─── new match alerts ────────────────────────────────────────────────
    const matched = await getMatchedPrograms(supabase, profile, { limit: 50 });

    if (matched.length > 0) {
      const { data: alreadyLogged } = await supabase
        .from('notification_log')
        .select('program_id')
        .eq('user_id', profile.id)
        .eq('type', 'new_match')
        .in('program_id', matched.map((p) => p.id));

      const seen = new Set((alreadyLogged ?? []).map((n) => n.program_id));
      const fresh = matched.filter((p) => !seen.has(p.id));

      if (fresh.length > 0) {
        try {
          await resend.emails.send({
            from: 'eunwon AI <alerts@eunwon.com>',
            to: email,
            subject: `새로운 지원사업 ${fresh.length}건이 매칭됐어요`,
            html: buildNewMatchEmailHtml(fresh),
          });

          await supabase
            .from('notification_log')
            .insert(fresh.map((p) => ({ user_id: profile.id, program_id: p.id, type: 'new_match' as const })));

          usersNotified++;
        } catch (err) {
          console.error(`Failed to send new-match email to profile ${profile.id}:`, err);
        }
      }
    }

    // ─── deadline warnings for saved programs ────────────────────────────
    const { data: savedRows } = await supabase
      .from('saved_programs')
      .select('program:programs(*)')
      .eq('user_id', profile.id)
      .in('status', ['saved', 'applied']);

    for (const row of (savedRows ?? []) as unknown as { program: Program | null }[]) {
      const program = row.program;
      if (!program) continue;

      const days = daysUntil(program.deadline_end);
      const milestone = DEADLINE_MILESTONES.find((m) => m.days === days);
      if (!milestone) continue;

      const { data: existing } = await supabase
        .from('notification_log')
        .select('id')
        .eq('user_id', profile.id)
        .eq('program_id', program.id)
        .eq('type', milestone.type)
        .maybeSingle();
      if (existing) continue;

      try {
        await resend.emails.send({
          from: 'eunwon AI <alerts@eunwon.com>',
          to: email,
          subject: `[마감 ${milestone.days}일] ${program.title}`,
          html: buildDeadlineEmailHtml(program, milestone.days),
        });

        await supabase
          .from('notification_log')
          .insert({ user_id: profile.id, program_id: program.id, type: milestone.type });

        deadlineAlertsSent++;
      } catch (err) {
        console.error(`Failed to send deadline alert to profile ${profile.id}:`, err);
      }
    }
  }

  return NextResponse.json({ usersNotified, deadlineAlertsSent });
}
