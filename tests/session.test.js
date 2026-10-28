import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Session } from '../src/session.js';
import { StringSession } from 'telegram/sessions/index.js';

describe('portable account sessions', () => {
  it('round trips exact salt and auth keys without exposing secrets to JSON', () => {
    const authKey = randomBytes(256);
    const original = new Session({
      dc: 4,
      authKey,
      salt: -9223372036854775808n,
      timeOffset: 12,
      test: false,
    });
    const restored = new Session(original.save()).options();
    assert.deepEqual(restored.authKey, authKey);
    assert.equal(restored.salt, -9223372036854775808n);
    assert.equal(restored.dc, 4);
    assert.equal(JSON.stringify(original), '"[Anygram session]"');
  });
  it('imports actual GramJS string sessions independently', async () => {
    const source = new StringSession('');
    source.setDC(2, '149.154.167.51', 443);
    const { AuthKey } = await import('telegram/crypto/AuthKey.js');
    const key = new AuthKey();
    await key.setKey(randomBytes(256));
    source.authKey = key;
    const session = new Session(source.save());
    assert.equal(session.options().dc, 2);
    assert.deepEqual(session.options().authKey, key.getKey());
  });
  it('rejects malformed, oversized and incompatible sessions', () => {
    assert.throws(() => new Session('not a session'), /session/i);
    assert.throws(
      () => new Session({ dc: 6, authKey: randomBytes(256) }),
      /center/i
    );
    assert.throws(
      () => new Session({ dc: 2, authKey: new Uint8Array(2) }),
      /key/i
    );
  });
  it('exports portable keys to the real GramJS session format and preserves imported endpoints', async () => {
    const original = new Session({ dc: 5, authKey: randomBytes(256) });
    const legacy = new StringSession(original.save('gramjs'));
    await legacy.load();
    assert.equal(legacy.dcId, 5);
    assert.equal(legacy.serverAddress, '149.154.171.5');
    assert.deepEqual(legacy.authKey.getKey(), original.options().authKey);
    legacy.setDC(5, '2001:0b28:f23f:f005::a', 443);
    const roundtrip = new StringSession(
      new Session(legacy.save()).save('gramjs')
    );
    assert.equal(roundtrip.serverAddress, legacy.serverAddress);
    assert.equal(roundtrip.port, 443);
    assert.throws(() => original.save('unknown'), /format/i);
  });
});
