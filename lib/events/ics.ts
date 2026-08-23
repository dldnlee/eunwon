import type { Event } from '@/lib/types';

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function compactDate(date: string): string { return date.replaceAll('-', ''); }

function addOneDay(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** RFC 5545 folding, bounded by UTF-8 bytes so Korean text is not split mid-character. */
function foldLine(line: string): string {
  const chunks: string[] = [];
  let chunk = '';
  for (const character of line) {
    const candidate = chunk + character;
    if (Buffer.byteLength(candidate, 'utf8') > 73 && chunk) {
      chunks.push(chunk); chunk = character;
    } else chunk = candidate;
  }
  if (chunk) chunks.push(chunk);
  return chunks.join('\r\n ');
}

export function buildEventIcs(event: Event, canonicalUrl: string): string {
  const start = event.event_start;
  if (!start) throw new Error('Event start date is required for calendar export');
  const end = event.event_end ?? start;
  const description = [event.host_org, event.location_name, event.apply_end ? `신청 마감: ${event.apply_end}` : null]
    .filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//eunwon AI//Events//KO', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:event-${event.id}@eunwon.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${compactDate(start)}`, `DTEND;VALUE=DATE:${compactDate(addOneDay(end))}`,
    `SUMMARY:${escapeIcs(event.title)}`, `DESCRIPTION:${escapeIcs(description)}`,
    `URL:${escapeIcs(canonicalUrl)}`, 'END:VEVENT', 'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
