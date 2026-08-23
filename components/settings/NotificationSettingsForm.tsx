'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const LEAD_DAY_OPTIONS = [1, 3, 7, 14] as const;

export function NotificationSettingsForm({
  userId,
  initialOpportunityDigest,
  initialDeadlineReminders,
  initialDeadlineReminderDays,
  initialEventReminders,
  initialEventReminderDays,
  isPro,
}: {
  userId: string;
  initialOpportunityDigest: boolean;
  initialDeadlineReminders: boolean;
  initialDeadlineReminderDays: number[];
  initialEventReminders: boolean;
  initialEventReminderDays: number[];
  isPro: boolean;
}) {
  const [opportunityDigest, setOpportunityDigest] = useState(initialOpportunityDigest);
  const [deadlineReminders, setDeadlineReminders] = useState(initialDeadlineReminders);
  const [reminderDays, setReminderDays] = useState(initialDeadlineReminderDays);
  const [eventReminders, setEventReminders] = useState(initialEventReminders);
  const [eventReminderDays, setEventReminderDays] = useState(initialEventReminderDays);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  function toggleDay(day: number) {
    setReminderDays((current) => current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => b - a));
  }

  function toggleEventDay(day: number) {
    setEventReminderDays((current) => current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => b - a));
  }

  async function savePreferences() {
    if (deadlineReminders && reminderDays.length === 0) {
      setSaveMessage('마감 알림 시점을 하나 이상 선택해 주세요.');
      return;
    }
    if (eventReminders && eventReminderDays.length === 0) {
      setSaveMessage('행사 알림 시점을 하나 이상 선택해 주세요.');
      return;
    }
    setSaving(true);
    setSaveMessage('');
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({
      notify_opportunity_digest: opportunityDigest,
      notify_deadline_reminders: deadlineReminders,
      deadline_reminder_days: reminderDays,
      notify_event_reminders: eventReminders,
      event_reminder_days: eventReminderDays,
      notify_email: opportunityDigest || deadlineReminders || eventReminders,
    }).eq('id', userId);
    setSaving(false);
    setSaveMessage(error ? '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' : '알림 설정을 저장했어요.');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>알림 설정</CardTitle>
        <CardDescription>
          {isPro
            ? '새로운 기회 브리핑과 저장한 사업의 마감 알림을 각각 설정할 수 있어요.'
            : 'Pro 플랜에서 매일 기회 브리핑과 저장한 사업의 마감 알림을 받을 수 있어요.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-lg">
        <section className="rounded-lg border border-hairline p-md">
        <label className="flex min-h-11 cursor-pointer items-start gap-sm text-body-sm text-charcoal">
          <input
            type="checkbox"
            checked={opportunityDigest}
            disabled={!isPro || saving}
            onChange={(e) => setOpportunityDigest(e.target.checked)}
            className="h-4 w-4 rounded border-hairline accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 disabled:opacity-50"
          />
          <span><strong className="block text-body-sm-medium text-ink">매일 기회 브리핑</strong><span className="text-caption text-steel">새로 신청 가능한 사업 중 우선순위가 높은 항목만 하루 한 번 보내드려요.</span></span>
        </label>
        </section>
        <section className="rounded-lg border border-hairline p-md">
          <label className="flex min-h-11 cursor-pointer items-start gap-sm text-body-sm text-charcoal">
            <input type="checkbox" checked={eventReminders} disabled={!isPro || saving}
              onChange={(e) => setEventReminders(e.target.checked)}
              className="h-4 w-4 rounded border-hairline accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 disabled:opacity-50" />
            <span><strong className="block text-body-sm-medium text-ink">저장한 행사 알림</strong><span className="text-caption text-steel">저장한 행사의 접수 마감과 시작일을 선택한 시점에 알려드려요.</span></span>
          </label>
          <fieldset disabled={!isPro || !eventReminders || saving} className="mt-sm">
            <legend className="mb-xs text-caption-bold text-ink">행사 알림 시점</legend>
            <div className="flex flex-wrap gap-xs">
              {LEAD_DAY_OPTIONS.map((day) => <label key={day} className="flex min-h-11 cursor-pointer items-center gap-xs rounded-full border border-hairline px-md text-body-sm text-charcoal has-[:checked]:border-ink has-[:checked]:bg-surface">
                <input type="checkbox" checked={eventReminderDays.includes(day)} onChange={() => toggleEventDay(day)} className="h-4 w-4 accent-ink" />{day}일 전
              </label>)}
            </div>
          </fieldset>
        </section>
        <section className="rounded-lg border border-hairline p-md">
          <label className="flex min-h-11 cursor-pointer items-start gap-sm text-body-sm text-charcoal">
            <input type="checkbox" checked={deadlineReminders} disabled={!isPro || saving}
              onChange={(e) => setDeadlineReminders(e.target.checked)}
              className="h-4 w-4 rounded border-hairline accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2 disabled:opacity-50" />
            <span><strong className="block text-body-sm-medium text-ink">저장한 사업 마감 알림</strong><span className="text-caption text-steel">북마크한 사업의 신청 마감을 선택한 시점에 알려드려요.</span></span>
          </label>
          <fieldset disabled={!isPro || !deadlineReminders || saving} className="mt-sm">
            <legend className="mb-xs text-caption-bold text-ink">알림 시점</legend>
            <div className="flex flex-wrap gap-xs">
              {LEAD_DAY_OPTIONS.map((day) => <label key={day} className="flex min-h-11 cursor-pointer items-center gap-xs rounded-full border border-hairline px-md text-body-sm text-charcoal has-[:checked]:border-ink has-[:checked]:bg-surface">
                <input type="checkbox" checked={reminderDays.includes(day)} onChange={() => toggleDay(day)} className="h-4 w-4 accent-ink" />마감 {day}일 전
              </label>)}
            </div>
          </fieldset>
        </section>
        <div className="flex items-center justify-end gap-sm max-sm:flex-col max-sm:items-stretch">
          <p role="status" aria-live="polite" className={`text-caption ${saveMessage.includes('못했') || saveMessage.includes('선택') ? 'text-error' : 'text-success-text'}`}>{saveMessage}</p>
          <Button type="button" onClick={savePreferences} disabled={!isPro || saving}>{saving ? '저장 중…' : '알림 설정 저장'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
