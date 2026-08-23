import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProgramDeadlineIcs } from './program-calendar';
import type { Program } from './types';

test('program deadline ICS is a stable timezone-safe all-day event', () => {
  const program = {
    id: '11111111-1111-4111-8111-111111111111',
    title: '서울 AI, 성장; 지원',
    agency: '서울특별시',
    deadline_end: '2026-09-30',
  } as Program;
  const ics = buildProgramDeadlineIcs(
    program,
    'https://eunwon.com/program/11111111-1111-4111-8111-111111111111',
    new Date('2026-08-23T00:00:00Z')
  );

  assert.match(ics, /DTSTART;VALUE=DATE:20260930\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261001\r\n/);
  assert.match(ics, /UID:program-11111111-1111-4111-8111-111111111111-deadline@eunwon\.com/);
  assert.match(ics, /SUMMARY:\[지원사업 마감\] 서울 AI\\, 성장\\; 지원/);
  assert.ok(ics.endsWith('\r\n'));
  assert.doesNotMatch(ics, /TZID|DTSTART:/);
});

test('program deadline ICS rejects open-ended programs', () => {
  assert.throws(
    () => buildProgramDeadlineIcs({ id: '1', title: '상시', deadline_end: null } as Program, 'https://eunwon.com/program/1'),
    /deadline/
  );
});
