import type { Program } from '@/lib/types';

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function compactDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('A date-only deadline is required');
  return value.replaceAll('-', '');
}

function addOneDay(value: string): string {
  const next = new Date(`${value}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function foldLine(line: string): string {
  const chunks: string[] = [];
  let chunk = '';
  for (const character of line) {
    const candidate = chunk + character;
    if (Buffer.byteLength(candidate, 'utf8') > 73 && chunk) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.join('\r\n ');
}

export function buildProgramDeadlineIcs(program: Program, canonicalUrl: string, now = new Date()): string {
  if (!program.deadline_end) throw new Error('Program deadline is required for calendar export');
  const deadline = compactDate(program.deadline_end);
  const exclusiveEnd = compactDate(addOneDay(program.deadline_end));
  const description = [program.agency, '지원사업 신청 마감', canonicalUrl].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//eunwon AI//Program Deadlines//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:program-${program.id}-deadline@eunwon.com`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${deadline}`,
    `DTEND;VALUE=DATE:${exclusiveEnd}`,
    `SUMMARY:${escapeIcs(`[지원사업 마감] ${program.title}`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `URL:${escapeIcs(canonicalUrl)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
