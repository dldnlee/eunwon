import assert from 'node:assert/strict';
import test from 'node:test';
import { safeAuthRedirectPath } from './auth-redirect';

test('auth redirects preserve internal destinations, query strings, and fragments', () => {
  for (const path of ['/', '/dashboard', '/compare?ids=a%2Cb#results', '/program/지원사업', '/dashboard?next=https://example.com']) {
    const expected = new URL(path, 'https://www.eunwon.com');
    assert.equal(safeAuthRedirectPath(path), expected.pathname + expected.search + expected.hash);
  }
});

test('auth redirects reject external URLs, scripts, backslashes, and control characters', () => {
  for (const path of [
    'https://example.com', '//example.com', '///example.com',
    'javascript:alert(1)', 'data:text/html,hello', 'dashboard',
    '/\\example.com', '/\\\\example.com', '/folder\\file',
    '/\t/example.com', '/\n/example.com', '/\r/example.com', '/dashboard\u0000',
    '/folder/..//example.com', '/%2e%2e//example.com',
  ]) {
    assert.equal(safeAuthRedirectPath(path), '/onboard', JSON.stringify(path));
    assert.equal(safeAuthRedirectPath(path, '/dashboard'), '/dashboard', JSON.stringify(path));
  }
});

test('missing or repeated next parameters use the flow-specific fallback', () => {
  for (const value of [undefined, null, '', ['/dashboard', '/onboard'], 42, {}]) {
    assert.equal(safeAuthRedirectPath(value), '/onboard');
    assert.equal(safeAuthRedirectPath(value, '/dashboard'), '/dashboard');
  }
});

test('auth redirects normalize dot segments before downstream route guards', () => {
  assert.equal(safeAuthRedirectPath('/dashboard/../signup/complete?from=login'), '/signup/complete?from=login');
  assert.equal(safeAuthRedirectPath('/dashboard/%2e%2e/login'), '/login');
});

test('query-decoded redirect targets remain on the application origin', () => {
  for (const query of [
    'next=%2F%5Cexample.com', 'next=%2F%09%2Fexample.com',
    'next=%2F%2Fexample.com', 'next=javascript%3Aalert(1)',
    'next=%2Fcompare%3Fids%3Da%252Cb%23results',
    'next=%2F%252Fexample.com', 'next=%2F%255Cexample.com',
  ]) {
    const path = safeAuthRedirectPath(new URLSearchParams(query).get('next'));
    assert.equal(new URL(path, 'https://www.eunwon.com').origin, 'https://www.eunwon.com', query);
    assert.ok(path.startsWith('/') && !path.startsWith('//'), query);
  }
});
