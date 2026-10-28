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
it('refreshes QR tokens, imports on the specified DC and saves the authorized session', async () => {
  const shown = [];
  const calls = [];
  let exports = 0;
  let polls = 0;
  let saved;
  const auth = new Authentication({
    apiId: 12,
    apiHash: 'hash',
    call: async (method, params, options) => {
      calls.push(method);
      if (method === 'users.getUsers') {
        throw unauthorized();
      }
      if (method === 'auth.exportLoginToken') {
        assert.deepEqual(params.except_ids, [9n]);
        if (++exports < 3) {
          return {
            _: 'auth.loginToken',
            token: new Uint8Array([exports, 255]),
            expires: Math.floor(Date.now() / 1000) + 30,
          };
        }
        return {
          _: 'auth.loginTokenMigrateTo',
          dc_id: 4,
          token: new Uint8Array([3]),
        };
      }
      assert.equal(method, 'auth.importLoginToken');
      assert.equal(options.dc, 4);
      assert.equal(options.migrate, true);
      assert.deepEqual(params.token, new Uint8Array([3]));
      return {
        _: 'auth.loginTokenSuccess',
        authorization: { user: { id: 7n } },
      };
    },
    pollUpdates: async () => {
      polls++;
    },
    saveSession: () => 'private-session',
    onSession: (session) => {
      saved = session;
    },
  });
  const user = await auth.start({
    qrCode: (value) => shown.push(value),
    exceptIds: [9n],
  });
  assert.equal(user.id, 7n);
  assert.equal(saved, 'private-session');
  assert.deepEqual(
    shown.map((x) => x.url),
    ['tg://login?token=Af8', 'tg://login?token=Av8']
  );
  assert.equal(polls, 2);
  assert.equal(calls.at(-1), 'auth.importLoginToken');
});
it('bounds QR refresh and rejects an already cancelled login before network access', async () => {
  const auth = new Authentication({
    apiId: 12,
    apiHash: 'hash',
    call: async (method) => {
      if (method === 'users.getUsers') {
        throw unauthorized();
      }
      return {
        _: 'auth.loginToken',
        expires: Math.floor(Date.now() / 1000) + 30,
        token: new Uint8Array([1]),
      };
    },
    pollUpdates: async () => {},
  });
  await assert.rejects(
    auth.start({ qrCode: () => {}, maxQrAttempts: 2 }),
    /QR login attempt limit/
  );
  auth.client.call = () => assert.fail('cancelled login reached network');
  await assert.rejects(
    auth.start({
      qrCode: () => {},
      signal: globalThis.AbortSignal.abort(new Error('cancel login')),
    }),
    /cancel login/
  );
});
