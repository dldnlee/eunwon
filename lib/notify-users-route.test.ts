import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { GET } from '../app/api/cron/notify-users/route';

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  subscription: 'pro',
  region: '서울',
  entity_type: '법인',
  updated_at: '2026-09-01T00:00:00Z',
  notify_opportunity_digest: true,
  notify_deadline_reminders: true,
  notify_event_reminders: true,
  deadline_reminder_days: [1],
  event_reminder_days: [1],
};
const program = {
  id: '22222222-2222-4222-8222-222222222222',
  title: '테스트 지원사업',
  agency: '테스트 기관',
  deadline_end: '2026-09-24',
  is_nationwide: true,
  required_extra_tags: [],
  required_certifications: [],
  required_business_traits: [],
  required_rnd_capability: [],
  required_tech_domains: [],
};
const event = {
  id: '33333333-3333-4333-8333-333333333333',
  title: '테스트 행사',
  apply_end: '2026-09-24',
  event_start: '2026-09-24',
};

function setup(t: TestContext, send: typeof fetch) {
  const env = {
    CRON_SECRET: 'test-notification-secret',
    RESEND_API_KEY: 're_test_notifications',
    NEXT_PUBLIC_SUPABASE_URL: 'https://notifications-test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-23T12:00:00Z') });
  const errors = t.mock.method(console, 'error', () => {});
  const writes: { table: string; body: unknown }[] = [];
  const emailKeys: string[] = [];
  t.mock.method(globalThis, 'fetch', async (...[input, init]: Parameters<typeof fetch>) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === 'https://api.resend.com' && url.pathname === '/emails') {
      emailKeys.push(request.headers.get('idempotency-key') ?? '');
      return send(input, init);
    }
    assert.equal(url.origin, env.NEXT_PUBLIC_SUPABASE_URL);
    if (url.pathname === `/auth/v1/admin/users/${profile.id}`) {
      return Response.json({ user: { id: profile.id, email: 'test@example.com', created_at: '2026-09-01T00:00:00Z' } });
    }
    const table = url.pathname.replace('/rest/v1/', '');
    if (request.method === 'POST' || request.method === 'PATCH') {
      writes.push({ table, body: await request.json() });
      return new Response(null, { status: 201 });
    }
    assert.equal(request.method, 'GET');
    switch (table) {
      case 'profiles': return Response.json(url.searchParams.has('subscription') ? [] : [profile]);
      case 'programs': return Response.json([program]);
      case 'saved_programs': return Response.json([{ program }]);
      case 'saved_events': return Response.json([{ event }]);
      case 'ai_program_ratings':
      case 'notification_log':
      case 'event_notification_log': return Response.json([]);
      default: throw new Error(`Unexpected database request: ${table}`);
    }
  });
  return { writes, emailKeys, errors };
}

function runCron() {
  return GET(new Request('https://example.com/api/cron/notify-users', {
    headers: { authorization: 'Bearer test-notification-secret' },
  }));
}

test('a failed digest does not prevent independent deadline and event reminders', async (t) => {
  let attempts = 0;
  const { writes, emailKeys } = setup(t, async () => {
    attempts++;
    return attempts === 1
      ? Response.json({ name: 'application_error', message: 'Digest rejected' }, { status: 500 })
      : Response.json({ id: `accepted-${attempts}` });
  });

  const response = await runCron();
  assert.deepEqual(await response.json(), { usersNotified: 0, deadlineAlertsSent: 1, trialWarningsSent: 0 });
  assert.equal(emailKeys.length, 4);
  assert.deepEqual(writes.map(({ table }) => table), [
    'notification_log', 'event_notification_log', 'event_notification_log',
  ]);
  assert.deepEqual(writes[0].body, { user_id: profile.id, program_id: program.id, type: 'deadline_reminder', lead_days: 1 });
});

for (const failure of [403, 429, 500, 'network'] as const) {
  test(`notification failures (${failure}) stay unrecorded and can succeed on a later run`, async (t) => {
    let failing = true;
    const { writes, emailKeys, errors } = setup(t, async () => {
      if (!failing) return Response.json({ id: 'accepted-email' });
      if (failure === 'network') throw new Error('Network unavailable');
      return Response.json({ name: 'application_error', message: 'Provider rejected email' }, { status: failure });
    });

    const failedResponse = await runCron();
    assert.equal(failedResponse.status, 200);
    assert.deepEqual(await failedResponse.json(), { usersNotified: 0, deadlineAlertsSent: 0, trialWarningsSent: 0 });
    assert.equal(writes.length, 0, 'failed sends must not consume notification deduplication state');
    assert.equal(emailKeys.length, 4, 'digest, deadline, and both event reminders are attempted');
    const deliveryErrors = errors.mock.calls.filter(({ arguments: args }) => String(args[0]).startsWith('Failed to send'));
    assert.equal(deliveryErrors.length, 4);

    failing = false;
    const successResponse = await runCron();
    assert.deepEqual(await successResponse.json(), { usersNotified: 1, deadlineAlertsSent: 1, trialWarningsSent: 0 });
    assert.deepEqual(writes.map(({ table }) => table), [
      'notification_log', 'notification_log', 'event_notification_log', 'event_notification_log',
    ]);
    assert.deepEqual(writes[0].body, [{ user_id: profile.id, program_id: program.id, type: 'new_match' }]);
    assert.deepEqual(writes[1].body, { user_id: profile.id, program_id: program.id, type: 'deadline_reminder', lead_days: 1 });
    assert.deepEqual(writes.slice(2).map(({ body }) => body), ['registration_deadline', 'event_start'].map((kind) => ({
      user_id: profile.id, event_id: event.id, reminder_kind: kind, lead_days: 1,
    })));
    assert.ok(emailKeys.every(Boolean));
    assert.deepEqual(emailKeys.slice(0, 4), emailKeys.slice(4), 'retry retains existing provider idempotency keys');
  });
}
