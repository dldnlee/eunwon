import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAdminCapability } from './admin-access';

function client(user: object | null, rpcResult: { data: boolean | null; error: object | null }) {
  let rpcCalled = false;
  return {
    value: {
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      rpc: async () => { rpcCalled = true; return rpcResult; },
    },
    rpcCalled: () => rpcCalled,
  };
}

test('admin capability defaults to false without an authenticated user', async () => {
  const mock = client(null, { data: true, error: null });
  assert.equal(await hasAdminCapability(mock.value as never, 'admin_access'), false);
  assert.equal(mock.rpcCalled(), false);
});

test('admin capability trusts only a successful true database authorization', async () => {
  const allowed = client({ id: 'operator' }, { data: true, error: null });
  const denied = client({ id: 'operator' }, { data: null, error: { message: 'denied' } });
  assert.equal(await hasAdminCapability(allowed.value as never, 'import_read'), true);
  assert.equal(await hasAdminCapability(denied.value as never, 'import_read'), false);
});
