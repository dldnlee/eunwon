import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorizedCronRequest } from './cron-auth';

test('cron authorization accepts only an exact configured bearer secret', () => {
  const secret = 'test-cron-secret';
  for (const [authorization, expected] of [
    [`Bearer ${secret}`, true],
    ['Bearer wrong-secret', false],
    [`Basic ${secret}`, false],
    [`Bearer ${secret}-suffix`, false],
    [secret, false],
    ['', false],
  ] as const) {
    const request = new Request('https://example.com/api/cron/test', {
      headers: { authorization },
    });
    assert.equal(isAuthorizedCronRequest(request, secret), expected);
  }
});
