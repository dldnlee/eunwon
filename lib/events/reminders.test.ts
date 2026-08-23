import assert from 'node:assert/strict';
import test from 'node:test';
import { getDueEventReminders } from './reminders';

test('event reminders independently cover registration deadline and occurrence start', () => {
  assert.deepEqual(getDueEventReminders(
    { apply_end: '2026-09-08', event_start: '2026-09-14' }, [7, 1], '2026-09-07'
  ), [
    { kind: 'registration_deadline', date: '2026-09-08', days: 1 },
    { kind: 'event_start', date: '2026-09-14', days: 7 },
  ]);
});

test('event reminders omit unknown dates and non-selected lead times', () => {
  assert.deepEqual(getDueEventReminders({ apply_end: null, event_start: '2026-09-20' }, [1], '2026-09-07'), []);
});
