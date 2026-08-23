import type { Event } from '@/lib/types';

export interface DueEventReminder {
  kind: 'registration_deadline' | 'event_start';
  date: string;
  days: number;
}

function calendarDaysBetween(today: string, target: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${target}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function getDueEventReminders(
  event: Pick<Event, 'apply_end' | 'event_start'>,
  leadDays: number[],
  today = new Date().toISOString().slice(0, 10)
): DueEventReminder[] {
  const targets = [
    { kind: 'registration_deadline' as const, date: event.apply_end },
    { kind: 'event_start' as const, date: event.event_start },
  ];
  return targets.flatMap((target) => {
    if (!target.date) return [];
    const days = calendarDaysBetween(today, target.date);
    return leadDays.includes(days) ? [{ kind: target.kind, date: target.date, days }] : [];
  });
}
