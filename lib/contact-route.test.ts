import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { POST } from '../app/api/contact/route';

const validContact = {
  name: '테스트 담당자',
  email: 'sender@example.com',
  message: '지원사업 문의입니다.',
};

function request(body: unknown = validContact) {
  return new Request('https://example.com/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setup(t: TestContext, send: typeof fetch) {
  const previousKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_contact';
  t.after(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  });
  t.mock.method(console, 'error', () => {});
  return t.mock.method(globalThis, 'fetch', send);
}

for (const status of [403, 429, 500]) {
  test(`contact returns a retryable failure when the email provider returns ${status}`, async (t) => {
    const fetch = setup(t, async () => Response.json({
      name: 'application_error',
      message: 'Internal provider detail that must not reach the user',
    }, { status }));

    const response = await POST(request());

    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: '문의 전송에 실패했어요. 잠시 후 다시 시도해주세요.',
    });
  });
}

test('contact reports success when the email provider accepts the email', async (t) => {
  const fetch = setup(t, async () => Response.json({ id: 'email-id' }));

  const response = await POST(request());

  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('contact returns a retryable failure when the email network request fails', async (t) => {
  setup(t, async () => { throw new Error('Network unavailable'); });

  const response = await POST(request());

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: '문의 전송에 실패했어요. 잠시 후 다시 시도해주세요.',
  });
});

test('contact rejects invalid input and ignores honeypots without sending email', async (t) => {
  const fetch = setup(t, async () => { throw new Error('Unexpected email request'); });

  const invalid = await POST(request({ ...validContact, email: 'invalid' }));
  assert.equal(invalid.status, 400);

  const honeypot = await POST(request({ ...validContact, website: 'spam.example' }));
  assert.equal(honeypot.status, 200);
  assert.deepEqual(await honeypot.json(), { ok: true });
  assert.equal(fetch.mock.callCount(), 0);
});
