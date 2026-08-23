import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { getMatchedPrograms } from '@/lib/matching';
import {
  buildMatchDigestEmail,
  escapeEmailHtml,
  getDigestConfig,
  selectDigestItems,
} from '@/lib/notifications/matchDigest';
import { isProUser, shouldWarnTrialEnding, trialDaysLeft } from '@/lib/trial';
import { daysUntil } from '@/lib/utils';
import { getDueEventReminders } from '@/lib/events/reminders';
import type { Event, Profile, Program } from '@/lib/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eunwon.com';
const MATCH_DIGEST_CANDIDATE_LIMIT = 200;

function buildDeadlineEmailHtml(program: Program, daysLeft: number): string {
  const programUrl = new URL(`/program/${program.id}?source=deadline-email`, APP_URL).toString();
  const settingsUrl = new URL('/settings/notifications', APP_URL).toString();
  return `<h2>[마감 ${daysLeft}일] ${escapeEmailHtml(program.title)}</h2><p>${escapeEmailHtml(program.agency)} · 저장하신 지원사업의 마감이 다가오고 있어요.</p><p>${escapeEmailHtml(program.ai_summary ?? '')}</p><p><a href="${programUrl}">지원사업 상세 보기</a> · <a href="${settingsUrl}">알림 설정</a></p>`;
}

function buildTrialEndingEmailHtml(daysLeft: number): string {
  return `<h2>무료체험이 ${daysLeft}일 후 종료돼요</h2><p>가입 후 3개월간 이용하신 Pro 기능(무제한 매칭, AI 설명, 사업계획서 생성, 마감 알림)이 곧 무료 플랜으로 전환돼요.</p><p>계속 이용하시려면 결제를 등록해주세요.</p>`;
}

function buildEventReminderEmailHtml(event: Event, daysLeft: number, kind: 'registration_deadline' | 'event_start'): string {
  const target = kind === 'registration_deadline' ? '접수 마감' : '행사 시작';
  const eventsUrl = new URL(`/events?event=${event.id}`, APP_URL).toString();
  const actionUrl = event.registration_url ?? event.detail_url ?? eventsUrl;
  return `<h2>[${target} ${daysLeft}일 전] ${escapeEmailHtml(event.title)}</h2><p>${escapeEmailHtml(event.host_org ?? '')}</p><p><a href="${actionUrl}">${kind === 'registration_deadline' ? '신청 페이지 보기' : '행사 정보 보기'}</a> · <a href="${eventsUrl}">저장한 행사 보기</a></p>`;
}

/**
 * Daily job (see vercel.json), Pro-only per the freemium model (real
 * subscription OR still within the signup trial — see lib/trial.ts) : for
 * each qualifying user —
 *   1. send one concise daily briefing of newly actionable matches, when enabled
 *   2. send configured deadline warnings for bookmarked programs, when enabled
 * `notification_log`'s unique(user_id, program_id, type) constraint is what
 * makes both idempotent across daily re-runs.
 *
 * Separately (and regardless of notify_email — this is an account/billing
 * notice, not a match-alert preference), warns trial users once in their
 * final week before the trial lapses to the free plan. See lib/trial.ts.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('Notification cron is missing RESEND_API_KEY');
    return NextResponse.json({ error: 'notification service unavailable' }, { status: 503 });
  }
  const resend = new Resend(resendApiKey);

  const supabase = createServiceClient();
  // Pro-vs-trial can't be filtered in SQL (trial is derived from auth.users.created_at), so fetch
  // profiles and apply the two independent notification preferences below.
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let usersNotified = 0;
  let deadlineAlertsSent = 0;

  for (const profile of (profiles ?? []) as Profile[]) {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email;
    if (!email) continue;
    if (!authUser?.user?.created_at || !isProUser(profile.subscription, authUser.user.created_at)) continue;

    const opportunityDigestEnabled = profile.notify_opportunity_digest ?? profile.notify_email;
    const deadlineRemindersEnabled = profile.notify_deadline_reminders ?? profile.notify_email;

    // ─── once-daily opportunity briefing ────────────────────────────────
    const matched = opportunityDigestEnabled
      ? await getMatchedPrograms(supabase, profile, { limit: MATCH_DIGEST_CANDIDATE_LIMIT })
      : [];

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
          const { data: ratingRows } = await supabase
            .from('ai_program_ratings')
            .select('program_id,match_rate,reason,rated_at')
            .eq('user_id', profile.id)
            .gte('rated_at', profile.updated_at)
            .in('program_id', fresh.map((program) => program.id));
          const ratings = Object.fromEntries((ratingRows ?? []).map((rating) => [
            rating.program_id,
            { matchRate: rating.match_rate, reason: rating.reason ?? '' },
          ]));
          const digestItems = selectDigestItems(fresh, profile, ratings, getDigestConfig());
          const digest = buildMatchDigestEmail({ items: digestItems, totalFresh: fresh.length, appUrl: APP_URL });

          await resend.emails.send({
            from: 'eunwon AI <alerts@eunwon.com>',
            to: email,
            subject: digest.subject,
            html: digest.html,
            text: digest.text,
          }, { idempotencyKey: `opportunity-${profile.id}-${new Date().toISOString().slice(0, 10)}` });

          // Mark the full evaluated candidate set, not just the displayed top items. Otherwise a
          // capped digest would drip yesterday's unchanged leftovers into later daily emails.
          const { error: digestLogError } = await supabase
            .from('notification_log')
            .insert(fresh.map((p) => ({ user_id: profile.id, program_id: p.id, type: 'new_match' as const })));
          if (digestLogError) {
            console.error(`Failed to persist opportunity digest state for ${profile.id}:`, digestLogError.message);
          }

          usersNotified++;
        } catch (err) {
          console.error(`Failed to send new-match email to profile ${profile.id}:`, err);
        }
      }
    }

    // ─── configurable deadline reminders for bookmarked programs ────────
    const reminderDays = profile.deadline_reminder_days?.length
      ? profile.deadline_reminder_days
      : [7, 3, 1];
    const { data: savedRows } = deadlineRemindersEnabled ? await supabase
      .from('saved_programs')
      .select('program:programs(*)')
      .eq('user_id', profile.id)
      .in('status', ['considering', 'preparing', 'submitted']) : { data: [] };

    for (const row of (savedRows ?? []) as unknown as { program: Program | null }[]) {
      const program = row.program;
      if (!program) continue;

      const days = daysUntil(program.deadline_end);
      if (days === null || !reminderDays.includes(days)) continue;

      const { data: existing } = await supabase
        .from('notification_log')
        .select('id')
        .eq('user_id', profile.id)
        .eq('program_id', program.id)
        .eq('type', 'deadline_reminder')
        .eq('lead_days', days)
        .maybeSingle();
      if (existing) continue;

      try {
        await resend.emails.send({
          from: 'eunwon AI <alerts@eunwon.com>',
          to: email,
          subject: `[마감 ${days}일] ${program.title}`,
          html: buildDeadlineEmailHtml(program, days),
        }, { idempotencyKey: `deadline-${profile.id}-${program.id}-${days}-${program.deadline_end}` });

        await supabase
          .from('notification_log')
          .insert({ user_id: profile.id, program_id: program.id, type: 'deadline_reminder', lead_days: days });

        deadlineAlertsSent++;
      } catch (err) {
        console.error(`Failed to send deadline alert to profile ${profile.id}:`, err);
      }
    }

    // ─── saved-event reminders (separate preference and dedupe namespace) ─
    if (profile.notify_event_reminders) {
      const eventReminderDays = profile.event_reminder_days?.length ? profile.event_reminder_days : [7, 1];
      const { data: savedEventRows } = await supabase.from('saved_events')
        .select('event:events(*)').eq('user_id', profile.id);
      for (const row of (savedEventRows ?? []) as unknown as { event: Event | null }[]) {
        const event = row.event;
        if (!event) continue;
        for (const target of getDueEventReminders(event, eventReminderDays)) {
          const days = target.days;
          const { data: existing } = await supabase.from('event_notification_log').select('id')
            .eq('user_id', profile.id).eq('event_id', event.id)
            .eq('reminder_kind', target.kind).eq('lead_days', days).maybeSingle();
          if (existing) continue;
          try {
            await resend.emails.send({
              from: 'eunwon AI <alerts@eunwon.com>', to: email,
              subject: `[${target.kind === 'registration_deadline' ? '접수 마감' : '행사 시작'} ${days}일 전] ${event.title}`,
              html: buildEventReminderEmailHtml(event, days, target.kind),
            }, { idempotencyKey: `event-${profile.id}-${event.id}-${target.kind}-${days}-${target.date}` });
            await supabase.from('event_notification_log').insert({
              user_id: profile.id, event_id: event.id, reminder_kind: target.kind, lead_days: days,
            });
          } catch (err) {
            console.error(`Failed to send event reminder for profile ${profile.id}:`, err);
          }
        }
      }
    }
  }

  // ─── trial-ending warnings ────────────────────────────────────────────
  // Independent of notify_email and of the loop above — candidates are any
  // non-paying account that hasn't been warned yet. subscription != 'pro'
  // over-fetches slightly (includes accounts whose trial expired long ago
  // and were never on notify_email), but shouldWarnTrialEnding() rejects
  // those cheaply once we have their auth user's created_at.
  let trialWarningsSent = 0;

  const { data: trialCandidates, error: trialCandidatesError } = await supabase
    .from('profiles')
    .select('*')
    .neq('subscription', 'pro')
    .is('trial_ending_notified_at', null);

  if (trialCandidatesError) {
    console.error('Failed to fetch trial-ending candidates:', trialCandidatesError.message);
  }

  for (const profile of (trialCandidates ?? []) as Profile[]) {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email;
    const createdAt = authUser?.user?.created_at;
    if (!email || !createdAt) continue;
    if (!shouldWarnTrialEnding(profile.subscription, createdAt, profile.trial_ending_notified_at)) continue;

    try {
      await resend.emails.send({
        from: 'eunwon AI <alerts@eunwon.com>',
        to: email,
        subject: '무료체험 종료가 얼마 남지 않았어요',
        html: buildTrialEndingEmailHtml(trialDaysLeft(createdAt)),
      });

      await supabase
        .from('profiles')
        .update({ trial_ending_notified_at: new Date().toISOString() })
        .eq('id', profile.id);

      trialWarningsSent++;
    } catch (err) {
      console.error(`Failed to send trial-ending warning to profile ${profile.id}:`, err);
    }
  }

  return NextResponse.json({ usersNotified, deadlineAlertsSent, trialWarningsSent });
}
