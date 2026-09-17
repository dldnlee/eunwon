import assert from 'node:assert/strict';
import test from 'node:test';
import { GET as chargeSubscriptions } from '../app/api/cron/charge-subscriptions/route';
import { GET as marketingGenerate } from '../app/api/cron/marketing-generate/route';
import { GET as notifyUsers } from '../app/api/cron/notify-users/route';
import { GET as syncEvents } from '../app/api/cron/sync-events/route';
import { GET as syncPrograms } from '../app/api/cron/sync-programs/route';

const routes = { chargeSubscriptions, marketingGenerate, notifyUsers, syncEvents, syncPrograms };

for (const [name, handler] of Object.entries(routes)) {
  for (const [scenario, secret, authorization] of [
    ['missing secret', undefined, 'Bearer undefined'],
    ['empty secret', '', 'Bearer'],
    ['blank secret', '   ', 'Bearer'],
    ['missing header', 'test-cron-secret', undefined],
    ['wrong secret', 'test-cron-secret', 'Bearer wrong-secret'],
  ] as const) {
    test(`${name} rejects ${scenario} before contacting services`, async (t) => {
      const previous = process.env.CRON_SECRET;
      if (secret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = secret;
      t.after(() => {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
      });
      t.mock.method(console, 'error', () => {});
      t.mock.method(console, 'warn', () => {});
      t.mock.method(console, 'info', () => {});
      const fetch = t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('Unauthorized cron must not contact external services');
      });
      const request = new Request('https://example.com/api/cron/test', {
        headers: authorization ? { authorization } : {},
      });

      const response = await handler(request);

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'unauthorized' });
      assert.equal(fetch.mock.callCount(), 0);
    });
  }
}
