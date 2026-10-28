import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Authentication } from '../src/authentication.js';
const unauthorized = () =>
  Object.assign(new Error('AUTH_KEY_UNREGISTERED'), { code: 401 });
it('logs in with callback credentials and preserves the returned code hash', async () => {
  const calls = [];
  const auth = new Authentication({
    apiId: 12,
    apiHash: 'hash',
    call: async (method, params) => {
      calls.push({ method, params });
      if (method === 'users.getUsers') {
        throw unauthorized();
      }
      if (method === 'auth.sendCode') {
        return { _: 'auth.sentCode', phone_code_hash: 'opaque-hash' };
      }
      assert.equal(params.phone_code_hash, 'opaque-hash');
      assert.equal(params.phone_code, '00123');
      return { _: 'auth.authorization', user: { id: 7n } };
    },
  });
  const user = await auth.start({
    phoneNumber: async () => '+1234567',
    phoneCode: async () => '00123',
  });
  assert.equal(user.id, 7n);
  assert.deepEqual(
    calls.map((call) => call.method),
    ['users.getUsers', 'auth.sendCode', 'auth.signIn']
  );
});
it('reuses an authorized account and never asks for new credentials', async () => {
  const auth = new Authentication({
    apiId: 12,
    apiHash: 'hash',
    call: async () => [{ id: 7n }],
  });
  assert.equal((await auth.start({ phoneNumber: () => assert.fail() })).id, 7n);
});
it('supports bot authorization through the independent MTProto client', async () => {
  const auth = new Authentication({
    apiId: 12,
    apiHash: 'hash',
    call: async (method, params) => {
      if (method === 'users.getUsers') {
        throw unauthorized();
      }
      assert.equal(method, 'auth.importBotAuthorization');
      assert.equal(params.bot_auth_token, 'bot:token');
      return { user: { id: 7n, bot: true } };
    },
  });
  assert.equal((await auth.start({ botAuthToken: 'bot:token' })).bot, true);
});
