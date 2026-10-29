import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api } from 'telegram';
import { Authentication } from '../src/authentication.js';
import { TlCodec } from '../src/tl.js';

function loginFixture(perform) {
  const calls = [];
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
  });
  return { auth, calls };
}

const sentCode = (type, hash = 'initial-hash') => ({
  _: 'auth.sentCode',
  type: { _: type },
  phone_code_hash: hash,
});
const success = { _: 'auth.authorization', user: { id: 7n } };

it('uses email_verification for login email codes and matches the real GramJS wire schema', async () => {
  const challenge = sentCode('auth.sentCodeTypeEmailCode');
  Object.assign(challenge.type, {
    email_pattern: 'a***@example.test',
    length: 6,
  });
  const { auth, calls } = loginFixture((method, params) => {
    if (method === 'auth.sendCode') {
      return challenge;
    }
    assert.equal(method, 'auth.signIn');
    assert.equal(params.phone_code, undefined);
    assert.deepEqual(params.email_verification, {
      _: 'emailVerificationCode',
      code: '001234',
    });
    assert.equal(params.phone_code_hash, 'initial-hash');
    const actual = new Api.auth.SignIn({
      phoneNumber: '+1234567',
      phoneCodeHash: 'initial-hash',
      emailVerification: new Api.EmailVerificationCode({ code: '001234' }),
    });
    assert.deepEqual(
      Buffer.from(new TlCodec().encode({ _: method, ...params })),
      actual.getBytes()
    );
    return success;
  });
  const user = await auth.start({
    phoneNumber: '+1234567',
    phoneCode: () => assert.fail('email challenge requested a phone code'),
    emailCode: (info) => {
      assert.equal(info.type.email_pattern, 'a***@example.test');
      info.phone_code_hash = 'mutated';
      return '001234';
    },
  });
  assert.equal(user.id, 7n);
  assert.equal(calls.length, 2);
});

it('sets up a login email and signs in with the new sent-code hash', async () => {
  const purpose = {
    _: 'emailVerifyPurposeLoginSetup',
    phone_number: '+1234567',
    phone_code_hash: 'initial-hash',
  };
  const { auth, calls } = loginFixture((method, params) => {
    if (method === 'auth.sendCode') {
      return sentCode('auth.sentCodeTypeSetUpEmailRequired');
    }
    if (method === 'account.sendVerifyEmailCode') {
      assert.deepEqual(params, { purpose, email: 'a@example.test' });
      return {
        _: 'account.sentEmailCode',
        email_pattern: 'a***@example.test',
        length: 6,
      };
    }
    if (method === 'account.verifyEmail') {
      assert.deepEqual(params, {
        purpose,
        verification: { _: 'emailVerificationCode', code: '000123' },
      });
      return {
        _: 'account.emailVerifiedLogin',
        email: 'a@example.test',
        sent_code: sentCode('auth.sentCodeTypeSms', 'new-hash'),
      };
    }
    assert.equal(method, 'auth.signIn');
    assert.equal(params.phone_code_hash, 'new-hash');
    assert.equal(params.phone_code, '54321');
    return success;
  });
  assert.equal(
    (
      await auth.start({
        phoneNumber: '+1234567',
        email: (info) => {
          info.phone_code_hash = 'mutated';
          return 'a@example.test';
        },
        emailCode: (info) => {
          assert.equal(info.email_pattern, 'a***@example.test');
          return '000123';
        },
        phoneCode: (info) => {
          assert.equal(info.type._, 'auth.sentCodeTypeSms');
          return '54321';
        },
      })
    ).id,
    7n
  );
  assert.deepEqual(
    calls.map((call) => call.method),
    [
      'auth.sendCode',
      'account.sendVerifyEmailCode',
      'account.verifyEmail',
      'auth.signIn',
    ]
  );
});

it('uses allowed Google/Apple email proofs without asking for email codes or replaying sign-in', async () => {
  for (const provider of ['Google', 'Apple']) {
    const flag = `${provider.toLowerCase()}_signin_allowed`;
    const { auth, calls } = loginFixture((method, params) => {
      if (method === 'auth.sendCode') {
        const challenge = sentCode('auth.sentCodeTypeSetUpEmailRequired');
        challenge.type[flag] = true;
        return challenge;
      }
      assert.equal(method, 'account.verifyEmail');
      assert.deepEqual(params.verification, {
        _: `emailVerification${provider}`,
        token: 'private-id-token',
      });
      return {
        _: 'account.emailVerifiedLogin',
        sent_code: { _: 'auth.sentCodeSuccess', authorization: success },
      };
    });
    assert.equal(
      (
        await auth.start({
          phoneNumber: '+1234567',
          emailVerification: (info) => {
            assert.equal(info.type[flag], true);
            return {
              _: `emailVerification${provider}`,
              token: 'private-id-token',
            };
          },
          email: () => assert.fail(),
          emailCode: () => assert.fail(),
          phoneCode: () => assert.fail(),
          maxLoginSteps: 1,
        })
      ).id,
      7n
    );
    assert.equal(calls.length, 2);
  }
});

it('rejects invalid or disallowed email proofs before sending them and preserves cancellation', async () => {
  for (const proof of [
    { _: 'emailVerificationGoogle', token: 'private-id-token' },
    { _: 'emailVerificationApple', token: 'private-id-token' },
    { _: 'emailVerificationCode', code: '' },
    { _: 'unknown', token: 'private-id-token' },
    null,
  ]) {
    const { auth, calls } = loginFixture(() =>
      sentCode('auth.sentCodeTypeEmailCode')
    );
    await assert.rejects(
      auth.start({ phoneNumber: '+1234567', emailVerification: () => proof }),
      /email|proof|allowed/i
    );
    assert.equal(calls.length, 1);
  }
  const controller = new globalThis.AbortController();
  const { auth, calls } = loginFixture(() =>
    sentCode('auth.sentCodeTypeEmailCode')
  );
  await assert.rejects(
    auth.start({
      phoneNumber: '+1234567',
      signal: controller.signal,
      emailCode: () => {
        controller.abort(new Error('cancel email login'));
        return '123456';
      },
    }),
    /cancel email login/
  );
  assert.equal(calls.length, 1);
});

it('bounds repeated email-setup challenges and rejects malformed verification replies', async () => {
  for (const malformed of [false, true]) {
    const { auth, calls } = loginFixture((method) =>
      method === 'auth.sendCode'
        ? {
            ...sentCode('auth.sentCodeTypeSetUpEmailRequired'),
            type: {
              _: 'auth.sentCodeTypeSetUpEmailRequired',
              google_signin_allowed: true,
            },
          }
        : malformed
          ? { _: 'account.emailVerified', email: 'a@example.test' }
          : {
              _: 'account.emailVerifiedLogin',
              sent_code: {
                ...sentCode('auth.sentCodeTypeSetUpEmailRequired'),
                type: {
                  _: 'auth.sentCodeTypeSetUpEmailRequired',
                  google_signin_allowed: true,
                },
              },
            }
    );
    await assert.rejects(
      auth.start({
        phoneNumber: '+1234567',
        maxLoginSteps: 2,
        emailVerification: {
          _: 'emailVerificationGoogle',
          token: 'private-id-token',
        },
      }),
      /limit|verification response/i
    );
    assert.equal(calls.length, malformed ? 2 : 3);
  }
});

it('signs in with allowed identity tokens and rejects invalid login limits before code requests', async () => {
  for (const provider of ['Google', 'Apple']) {
    const { auth, calls } = loginFixture((method, params) => {
      if (method === 'auth.sendCode') {
        const code = sentCode('auth.sentCodeTypeEmailCode');
        code.type[`${provider.toLowerCase()}_signin_allowed`] = true;
        return code;
      }
      assert.equal(method, 'auth.signIn');
      assert.equal(params.phone_code, undefined);
      assert.deepEqual(params.email_verification, {
        _: `emailVerification${provider}`,
        token: 'private-id-token',
      });
      const expected = new Api.auth.SignIn({
        phoneNumber: '+1234567',
        phoneCodeHash: 'initial-hash',
        emailVerification: new Api[`EmailVerification${provider}`]({
          token: 'private-id-token',
        }),
      });
      assert.deepEqual(
        Buffer.from(new TlCodec().encode({ _: method, ...params })),
        expected.getBytes()
      );
      return success;
    });
    assert.equal(
      (
        await auth.start({
          phoneNumber: '+1234567',
          emailVerification: {
            _: `emailVerification${provider}`,
            token: 'private-id-token',
          },
        })
      ).id,
      7n
    );
    assert.equal(calls.length, 2);
  }
  for (const maxLoginSteps of [0, -1, 1.5, Infinity, NaN, 1001]) {
    const { auth, calls } = loginFixture(() => assert.fail());
    await assert.rejects(
      auth.start({ phoneNumber: '+1234567', maxLoginSteps }),
      /limit/i
    );
    assert.equal(calls.length, 0);
  }
});
