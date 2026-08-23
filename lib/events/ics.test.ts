import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventIcs } from './ics';
import type { Event } from '../types';

test('ICS uses timezone-safe all-day dates, stable identity, URL, escaping, and CRLF', () => {
  const event = { id: 'event-id', title: 'AI, 세미나; 실전', event_start: '2026-09-10', event_end: '2026-09-10',
    host_org: '지원기관', location_name: '서울', apply_end: '2026-09-05' } as Event;
  const ics = buildEventIcs(event, 'https://eunwon.com/events?event=event-id');
  assert.match(ics, /DTSTART;VALUE=DATE:20260910\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20260911\r\n/);
  assert.match(ics, /UID:event-event-id@eunwon.com/);
  assert.match(ics, /SUMMARY:AI\\, 세미나\\; 실전/);
  assert.match(ics, /URL:https:\/\/eunwon.com\/events\?event=event-id/);
  assert.doesNotMatch(ics, /(?<!\r)\n/);
});

test('ICS rejects events without a known occurrence date', () => {
  assert.throws(() => buildEventIcs({ id: 'x', event_start: null } as Event, 'https://eunwon.com/events'), /required/);
});
