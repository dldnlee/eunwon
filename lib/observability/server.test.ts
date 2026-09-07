import assert from 'node:assert/strict';
import test from 'node:test';
import { requestCorrelationId } from './server';

test('preserves a safe inbound correlation ID', () => {
  assert.equal(requestCorrelationId(new Request('https://example.com', { headers: { 'x-request-id': 'req_12345678' } })), 'req_12345678');
});

test('rejects malformed correlation IDs', () => {
  const id = requestCorrelationId(new Request('https://example.com', { headers: { 'x-request-id': 'bad id value' } }));
  assert.match(id, /^[0-9a-f-]{36}$/);
});
