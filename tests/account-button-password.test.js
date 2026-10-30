import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { gramRequest, requestOf } from '../src/requests.js';
import { buttonPage } from './fixtures/account-buttons.js';
import {
  ownedMessage,
  sdkMessage,
  canonical,
} from './fixtures/account-message-models.js';

function server() {
  const source = readFileSync(
    new globalThis.URL('../node_modules/telegram/Password.js', import.meta.url),
    'utf8'
  );
  const bytes = source
    .match(/const goodPrime = Buffer.from\(\[([\s\S]*?)\]\)/)[1]
    .match(/0x[0-9a-f]+/g);
  const p = Buffer.from(bytes.map((byte) => Number(byte)));
  const integer = (bytes) => BigInt(`0x${Buffer.from(bytes).toString('hex')}`);
  const pad = (number) =>
    Buffer.from(number.toString(16).padStart(512, '0'), 'hex');
  const hash = (...parts) =>
    createHash('sha256').update(Buffer.concat(parts)).digest();
  const salted = (data, salt) => hash(salt, data, salt);
  const prime = integer(p);
  const pow = (base, exponent) => {
    let result = 1n;
    for (; exponent; exponent >>= 1n) {
      if (exponent & 1n) {
        result = (result * base) % prime;
      }
      base = (base * base) % prime;
    }
    return result;
  };
  const salt1 = Buffer.from('callback salt one');
  const salt2 = Buffer.from('callback salt two');
  const x = integer(
    salted(
      pbkdf2Sync(
        salted(salted(Buffer.from('callback password'), salt1), salt2),
        salt1,
        100000,
        64,
        'sha512'
      ),
      salt2
    )
  );
  const g = 3n;
  const verifier = pow(g, x);
  const b = integer(Buffer.alloc(256, 17));
  const B = (integer(hash(p, pad(g))) * verifier + pow(g, b)) % prime;
  return {
    parameters: {
      _: 'account.password',
      current_algo: {
        _: 'passwordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow',
        p,
        g: Number(g),
        salt1,
        salt2,
      },
      srp_B: pad(B),
      srp_id: 7n,
      new_algo: { _: 'passwordKdfAlgoUnknown' },
      new_secure_algo: { _: 'securePasswordKdfAlgoUnknown' },
      secure_random: Buffer.alloc(16),
    },
    verify(proof) {
      const value = canonical(proof);
      const A = Buffer.from(value.A);
      const u = integer(hash(A, pad(B)));
      const secret = pow((integer(A) * pow(verifier, u)) % prime, b);
      const hp = hash(p),
        hg = hash(pad(g));
      assert.equal(BigInt(value.srp_id), 7n);
      assert.deepEqual(
        Buffer.from(value.M1),
        hash(
          Buffer.from(hp.map((byte, index) => byte ^ hg[index])),
          hash(salt1),
          hash(salt2),
          A,
          pad(B),
          hash(pad(secret))
        )
      );
    },
  };
}

for (const [style, Vendor] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`verifies actual ${style} and owned password-protected callback proofs with independent SRP server arithmetic`, async () => {
    const srp = server();
    const source = buttonPage(style, ['callback']);
    const actual = sdkMessage(Vendor, source).message;
    const methods = [];
    actual.client.invoke = async (request) => {
      methods.push(request.className);
      if (request.className === 'account.GetPassword') {
        return gramRequest(Vendor, requestOf(srp.parameters));
      }
      srp.verify(request.password);
      return {
        _: 'messages.botCallbackAnswer',
        cache_time: 0,
        message: 'verified',
      };
    };
    assert.equal(
      (await actual.click({ password: 'callback password' })).message,
      'verified'
    );
    assert.deepEqual(methods, [
      'account.GetPassword',
      'messages.GetBotCallbackAnswer',
    ]);
    const { message, calls } = await ownedMessage(
      style,
      source,
      (method, params) => {
        if (method === 'account.getPassword') {
          return srp.parameters;
        }
        srp.verify(params.password);
        return {
          _: 'messages.botCallbackAnswer',
          cache_time: 0,
          message: 'verified',
        };
      }
    );
    assert.equal(
      (await message.click({ password: 'callback password' })).message,
      'verified'
    );
    assert.deepEqual(
      calls.map(([method]) => method),
      ['account.getPassword', 'messages.getBotCallbackAnswer']
    );
    assert.equal(calls[1][1].password._, 'inputCheckPasswordSRP');
  });
}

it('does not press a callback after cancellation while reading password parameters', async () => {
  const controller = new globalThis.AbortController();
  const reason = new Error('password request cancelled');
  const { message, calls } = await ownedMessage(
    'teleproto',
    buttonPage(),
    () => {
      controller.abort(reason);
      return {
        _: 'account.password',
        current_algo: { _: 'passwordKdfAlgoUnknown' },
      };
    }
  );
  await assert.rejects(
    message.click({ password: 'callback password', signal: controller.signal }),
    (error) => error === reason
  );
  assert.equal(calls.length, 1);
});

it('rejects invalid password values and server algorithms without sending callbacks', async () => {
  const { message, calls } = await ownedMessage(
    'teleproto',
    buttonPage(),
    () => ({
      _: 'account.password',
      current_algo: { _: 'passwordKdfAlgoUnknown' },
    })
  );
  await assert.rejects(message.click({ password: 123 }), /string/);
  assert.equal(calls.length, 0);
  await assert.rejects(
    message.click({ password: 'callback password' }),
    /algorithm/
  );
  assert.equal(calls.length, 1);
});
