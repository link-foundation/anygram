import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api } from 'teleproto';
import { Authentication } from '../src/authentication.js';
import { TlCodec } from '../src/tl.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const success = { _: 'auth.authorization', user: { id: 7n } };
const challenge = (hash = 'first', type = 'App') => ({
  _: 'auth.sentCode',
  type: { _: `auth.sentCodeType${type}`, length: 5 },
  phone_code_hash: hash,
  next_type: { _: 'auth.codeTypeSms' },
  timeout: 0,
});
function fixture(perform) {
  const calls = [];
  const saved = [];
  const auth = new Authentication({
    apiId: 12,
    apiHash: 'hash',
    call: async (method, params, options) => {
      if (method === 'users.getUsers') {
        throw Object.assign(new Error('AUTH_KEY_UNREGISTERED'), { code: 401 });
      }
      calls.push({ method, params, options });
      return perform(method, params, options);
    },
    saveSession: () => 'private-session',
    onSession: (session) => saved.push(session),
  });
  return { auth, calls, saved };
}
const options = { phoneNumber: '+1234567', phoneCode: '00001' };

it('resends the advertised delivery method with the original hash and uses the new hash for sign-in', async () => {
  const initial = challenge();
  let seen = 0;
  const { auth, calls, saved } = fixture((method, params) => {
    if (method === 'auth.sendCode') {
      return initial;
    }
    if (method === 'auth.resendCode') {
      assert.deepEqual(params, {
        phone_number: '+1234567',
        phone_code_hash: 'first',
        reason: 'SMS requested by application',
      });
      const expected = new Api.auth.ResendCode({
        phoneNumber: '+1234567',
        phoneCodeHash: 'first',
        reason: params.reason,
      });
      assert.deepEqual(
        Buffer.from(new TlCodec().encode({ _: method, ...params })),
        expected.getBytes()
      );
      return challenge('second', 'Sms');
    }
    assert.equal(method, 'auth.signIn');
    assert.equal(params.phone_code_hash, 'second');
    assert.equal(params.phone_code, '00002');
    return success;
  });
  const user = await auth.start({
    ...options,
    onCode: (copy) => {
      if (++seen === 1) {
        assert.equal(copy.next_type._, 'auth.codeTypeSms');
        copy.phone_code_hash = 'changed';
        copy.next_type._ = 'changed';
        return { action: 'resend', reason: 'SMS requested by application' };
      }
      assert.equal(copy.phone_code_hash, 'second');
    },
    phoneCode: (copy) => {
      assert.equal(copy.type._, 'auth.sentCodeTypeSms');
      return '00002';
    },
  });
  assert.equal(user.id, 7n);
  assert.equal(initial.phone_code_hash, 'first');
  assert.equal(initial.next_type._, 'auth.codeTypeSms');
  assert.deepEqual(
    calls.map((entry) => entry.method),
    ['auth.sendCode', 'auth.resendCode', 'auth.signIn']
  );
  assert.deepEqual(saved, ['private-session']);
});

it('cancels the active code before email setup or code prompts and never saves authorization', async () => {
  for (const response of [true, false]) {
    const { auth, calls, saved } = fixture((method, params) => {
      if (method === 'auth.sendCode') {
        return challenge('email-hash', 'SetUpEmailRequired');
      }
      assert.equal(method, 'auth.cancelCode');
      assert.deepEqual(params, {
        phone_number: '+1234567',
        phone_code_hash: 'email-hash',
      });
      const expected = new Api.auth.CancelCode({
        phoneNumber: '+1234567',
        phoneCodeHash: 'email-hash',
      });
      assert.deepEqual(
        Buffer.from(new TlCodec().encode({ _: method, ...params })),
        expected.getBytes()
      );
      return response;
    });
    await assert.rejects(
      auth.start({
        ...options,
        onCode: () => ({ action: 'cancel' }),
        phoneCode: () => assert.fail('cancelled login asked for a code'),
        email: () => assert.fail('cancelled login asked for an email'),
      }),
      { type: 'LOGIN_CANCELLED' }
    );
    assert.equal(calls.length, 2);
    assert.deepEqual(saved, []);
  }
});

it('cancels the most recently resent hash and accepts immediate authorization without another prompt', async () => {
  for (const cancelled of [false, true]) {
    let count = 0;
    const { auth, calls, saved } = fixture((method, params) => {
      if (method === 'auth.sendCode') {
        return challenge();
      }
      if (method === 'auth.resendCode') {
        return cancelled
          ? challenge('latest')
          : { _: 'auth.sentCodeSuccess', authorization: success };
      }
      assert.equal(method, 'auth.cancelCode');
      assert.equal(params.phone_code_hash, 'latest');
      return true;
    });
    const login = auth.start({
      ...options,
      onCode: () => ({ action: count++ ? 'cancel' : 'resend' }),
    });
    if (cancelled) {
      await assert.rejects(login, { type: 'LOGIN_CANCELLED' });
      assert.equal(calls.length, 3);
      assert.deepEqual(saved, []);
    } else {
      assert.equal((await login).id, 7n);
      assert.equal(count, 1);
      assert.deepEqual(saved, ['private-session']);
    }
  }
});

it('validates delivery actions, callback types and advertised fallbacks before sending another request', async () => {
  for (const action of [
    null,
    true,
    'resend',
    {},
    { action: 'other' },
    { action: 'resend', reason: 1 },
    { action: 'cancel', reason: 'invalid' },
  ]) {
    const { auth, calls } = fixture(() => challenge());
    await assert.rejects(
      auth.start({ ...options, onCode: () => action }),
      /delivery action/i
    );
    assert.equal(calls.length, 1);
  }
  const { auth, calls } = fixture(() => {
    const value = challenge();
    delete value.next_type;
    return value;
  });
  await assert.rejects(
    auth.start({ ...options, onCode: () => ({ action: 'resend' }) }),
    { type: 'LOGIN_CODE_RESEND_UNAVAILABLE' }
  );
  assert.equal(calls.length, 1);
  await assert.rejects(auth.start({ ...options, onCode: true }), /onCode/);
  assert.equal(calls.length, 1);
});

it('bounds delivery changes and rejects malformed resend responses without signing in', async () => {
  const { auth, calls } = fixture(() => challenge());
  await assert.rejects(
    auth.start({
      ...options,
      maxLoginSteps: 2,
      onCode: () => ({ action: 'resend' }),
    }),
    { type: 'LOGIN_STEP_LIMIT' }
  );
  assert.deepEqual(
    calls.map((entry) => entry.method),
    ['auth.sendCode', 'auth.resendCode', 'auth.resendCode']
  );
  for (const result of [null, {}, true]) {
    const failed = fixture((method) =>
      method === 'auth.sendCode' ? challenge() : result
    );
    await assert.rejects(
      failed.auth.start({ ...options, onCode: () => ({ action: 'resend' }) }),
      /resend response/i
    );
    assert.equal(failed.calls.length, 2);
  }
});

it('preserves cancellation after an asynchronous delivery decision and never replays rejected resend requests', async () => {
  const controller = new globalThis.AbortController();
  const cancelled = fixture(() => challenge());
  await assert.rejects(
    cancelled.auth.start({
      ...options,
      signal: controller.signal,
      onCode: async () => {
        await Promise.resolve();
        controller.abort(new Error('cancel while deciding delivery'));
        return { action: 'resend' };
      },
    }),
    /cancel while deciding delivery/
  );
  assert.equal(cancelled.calls.length, 1);
  const error = Object.assign(new Error('FLOOD_WAIT_30'), {
    code: 420,
    retryAfter: 30,
  });
  const failed = fixture((method, _, requestOptions) => {
    if (method === 'auth.sendCode') {
      return challenge();
    }
    assert.equal(requestOptions.timeout, 12000);
    throw error;
  });
  await assert.rejects(
    failed.auth.start({
      ...options,
      timeout: 12000,
      onCode: () => ({ action: 'resend' }),
    }),
    (value) => value === error
  );
  assert.equal(failed.calls.length, 2);
  assert.deepEqual(failed.saved, []);
});

it('allows delivery fallback before processing login-email and Firebase-only challenges', async () => {
  for (const type of ['EmailCode', 'FirebaseSms']) {
    const { auth, calls } = fixture((method) => {
      if (method === 'auth.sendCode') {
        return challenge('restricted', type);
      }
      if (method === 'auth.resendCode') {
        return challenge('fallback', 'Sms');
      }
      assert.equal(method, 'auth.signIn');
      return success;
    });
    const user = await auth.start({
      ...options,
      onCode: (copy) => {
        if (copy.phone_code_hash === 'restricted') {
          return { action: 'resend' };
        }
      },
      emailCode: () => assert.fail('fallback still requested an email code'),
    });
    assert.equal(user.id, 7n);
    assert.equal(calls.length, 3);
  }
});

it('does not save a session when an immediate resend success has no authorized user', async () => {
  for (const authorization of [undefined, null, {}, { user: null }]) {
    const { auth, calls, saved } = fixture((method) =>
      method === 'auth.sendCode'
        ? challenge()
        : { _: 'auth.sentCodeSuccess', authorization }
    );
    await assert.rejects(
      auth.start({ ...options, onCode: () => ({ action: 'resend' }) }),
      /authorization response/i
    );
    assert.equal(calls.length, 2);
    assert.deepEqual(saved, []);
  }
});

it('performs code fallback and cancellation over the native encrypted TCP RPC transport', async () => {
  for (const cancel of [false, true]) {
    const requests = [];
    const saved = [];
    const peer = await secretRpcPeer((request) => {
      requests.push(request._);
      if (request._ === 'users.getUsers') {
        return {
          _: 'rpc_error',
          error_code: 401,
          error_message: 'AUTH_KEY_UNREGISTERED',
        };
      }
      if (request._ === 'auth.sendCode') {
        return challenge();
      }
      assert.equal(request.phone_number, '+1234567');
      if (request._ === 'auth.resendCode') {
        assert.equal(request.phone_code_hash, 'first');
        return challenge('last', 'Sms');
      }
      assert.equal(request.phone_code_hash, 'last');
      if (cancel) {
        assert.equal(request._, 'auth.cancelCode');
        return true;
      }
      assert.equal(request._, 'auth.signIn');
      assert.equal(request.phone_code, '00001');
      return {
        _: 'auth.authorization',
        user: { _: 'user', id: 7n, self: true, first_name: 'Native' },
      };
    });
    try {
      peer.client.apiHash = 'hash';
      peer.client.onSession = (state) => saved.push(state);
      const login = peer.client.start({
        ...options,
        onCode: (code) => {
          if (code.phone_code_hash === 'first') {
            return { action: 'resend' };
          }
          if (cancel) {
            return { action: 'cancel' };
          }
        },
      });
      if (cancel) {
        await assert.rejects(login, { type: 'LOGIN_CANCELLED' });
        assert.equal(saved.length, 0);
      } else {
        assert.equal((await login).id, 7n);
        assert.equal(saved.length, 1);
      }
      assert.deepEqual(requests, [
        'users.getUsers',
        'auth.sendCode',
        'auth.resendCode',
        cancel ? 'auth.cancelCode' : 'auth.signIn',
      ]);
    } finally {
      await peer.close();
    }
  }
});
