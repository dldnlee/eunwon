import assert from 'node:assert/strict';
import test from 'node:test';
import { daysUntil } from './utils';

for (const timezone of ['UTC', 'Asia/Seoul', 'America/Los_Angeles', 'Pacific/Auckland']) {
  test(`deadline days follow the Korean calendar when the host uses ${timezone}`, (t) => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = timezone;
    t.after(() => {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    });
    t.mock.timers.enable({ apis: ['Date'], now: 0 });

    const cases = [
      // The same deadline transitions at midnight in Korea, not midnight on the host.
      ['2026-09-24T14:59:59Z', '2026-09-25', 1],
      ['2026-09-24T15:00:00Z', '2026-09-25', 0],
      ['2026-09-25T14:59:59Z', '2026-09-25', 0],
      ['2026-09-25T15:00:00Z', '2026-09-25', -1],
      // Month/year rollover and leap days remain calendar-day differences.
      ['2026-12-31T15:00:00Z', '2027-01-01', 0],
      ['2028-02-28T15:00:00Z', '2028-03-01', 1],
      ['2028-02-29T15:00:00Z', '2028-02-29', -1],
      // Host daylight-saving transitions must not alter Korean deadline counts.
      ['2026-03-08T15:00:00Z', '2026-03-10', 1],
      ['2026-11-01T15:00:00Z', '2026-11-03', 1],
    ] as const;

    for (const [now, deadline, expected] of cases) {
      t.mock.timers.setTime(Date.parse(now));
      assert.equal(daysUntil(deadline), expected, `${now}: ${deadline}`);
    }
  });
}

test('open-ended deadlines have no days remaining', () => {
  assert.equal(daysUntil(null), null);
  assert.equal(daysUntil(''), null);
});
