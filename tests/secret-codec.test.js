import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as protocol from '../src/mtproto.js';
import schema from '../src/schema/secret.json' with { type: 'json' };
import jsonSource from '../docs/case-studies/issue-1/data/secret-schema.json' with { type: 'json' };
import { createFixtureFactory } from '../experiments/tl-fixtures.mjs';

it('round trips all ninety versioned secret-schema constructors at their defining layers', () => {
  assert.equal(schema.constructors.length, 90);
  for (const definition of schema.constructors) {
    const codec = new protocol.SecretChatCodec({ layer: definition.layer });
    const fixture = createFixtureFactory(codec)(definition);
    const bytes = codec.encode(fixture);
    assert.equal(
      new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true),
      Number(definition.id) >>> 0,
      definition.predicate
    );
    assert.deepEqual(
      codec.encode(codec.decode(bytes)),
      bytes,
      definition.predicate
    );
  }
});

it('retains TL flag-only fields omitted by the primary JSON schema and preserves source provenance', () => {
  const source = readFileSync(
    new globalThis.URL(
      '../docs/case-studies/issue-1/data/secret-schema.md',
      import.meta.url
    )
  );
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    schema.sha256
  );
  let flagOnly = 0;
  for (const definition of schema.constructors) {
    const other = jsonSource.constructors.find(
      (entry) => Number(entry.id) >>> 0 === Number(definition.id) >>> 0
    );
    assert.ok(other, definition.predicate);
    assert.deepEqual(
      definition.params.filter((field) => !field.type.endsWith('?true')),
      other.params,
      definition.predicate
    );
    flagOnly += definition.params.filter((field) =>
      field.type.endsWith('?true')
    ).length;
  }
  assert.equal(flagOnly, 4);
});

it('matches a hand-written layer-73 secret message wire vector', () => {
  const codec = new protocol.SecretChatCodec();
  const message = {
    _: 'decryptedMessage',
    random_id: -7n,
    ttl: 0,
    message: 'Hi',
  };
  const expected = Buffer.from(
    '7446cc9100000000f9ffffffffffffff0000000002486900',
    'hex'
  );
  assert.deepEqual(Buffer.from(codec.encode(message)), expected);
  const decoded = codec.decode(expected, 'DecryptedMessage');
  assert.equal(decoded.random_id, -7n);
  assert.equal(decoded.message, 'Hi');
  assert.equal(decoded.no_webpage, false);
});

it('selects negotiated secret-chat layers while decoding older constructor IDs', () => {
  const legacy = new protocol.SecretChatCodec({ layer: 8 });
  const message = {
    _: 'decryptedMessage',
    random_id: 7n,
    random_bytes: new Uint8Array(16).fill(1),
    message: 'legacy',
    media: { _: 'decryptedMessageMediaEmpty' },
  };
  const bytes = legacy.encode(message);
  assert.equal(
    new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true),
    0x1f814f1f
  );
  const current = new protocol.SecretChatCodec();
  assert.equal(current.decode(bytes).message, 'legacy');
  assert.deepEqual(legacy.encode(legacy.decode(bytes)), bytes);
  assert.throws(
    () =>
      legacy.encode({
        _: 'decryptedMessageActionRequestKey',
        exchange_id: 1n,
        g_a: new Uint8Array(),
      }),
    /Unknown TL/
  );
  const newer = current.encode({
    _: 'decryptedMessage',
    random_id: 1n,
    ttl: 0,
    message: 'new',
  });
  assert.throws(() => legacy.decode(newer), /constructor/i);
});

it('serializes flagged secret messages, entities, exact document sizes and layer wrappers', () => {
  const codec = new protocol.SecretChatCodec();
  const wrapper = {
    _: 'decryptedMessageLayer',
    random_bytes: new Uint8Array(16),
    layer: 144,
    in_seq_no: 0,
    out_seq_no: 1,
    message: {
      _: 'decryptedMessage',
      random_id: 9007199254740993n,
      ttl: 60,
      message: '📎 hi',
      grouped_id: -9n,
      silent: true,
      entities: [{ _: 'messageEntityBold', offset: 3, length: 2 }],
      media: {
        _: 'decryptedMessageMediaDocument',
        thumb: new Uint8Array(),
        thumb_w: 0,
        thumb_h: 0,
        mime_type: 'application/octet-stream',
        size: 9007199254740993n,
        key: new Uint8Array(32),
        iv: new Uint8Array(32),
        caption: '',
        attributes: [
          { _: 'documentAttributeFilename', file_name: 'example.bin' },
        ],
      },
    },
  };
  const value = codec.decode(codec.encode(wrapper), 'DecryptedMessageLayer');
  assert.equal(value.message.random_id, 9007199254740993n);
  assert.equal(value.message.media.size, 9007199254740993n);
  assert.equal(value.message.entities[0].offset, 3);
  assert.equal(value.message.silent, true);
  assert.equal(value.message.grouped_id, -9n);
  assert.equal(value.out_seq_no, 1);
});

it('keeps group-call secret-schema additions separate from negotiated chat layers', () => {
  const codec = new protocol.SecretChatCodec({ layer: 216 });
  const message = {
    _: 'groupCallMessage',
    random_id: 1n,
    message: { _: 'textWithEntities', text: 'Hi', entities: [] },
  };
  assert.equal(codec.decode(codec.encode(message)).message.text, 'Hi');
  assert.throws(
    () => new protocol.SecretChatCodec().encode(message),
    /Unknown TL/
  );
});

it('bounds secret-chat TL input and rejects cloud methods, unknown layers and wrong types', () => {
  for (const layer of [0, 7, 217, Infinity, NaN, 73.5, '144']) {
    assert.throws(() => new protocol.SecretChatCodec({ layer }), /layer/i);
  }
  const codec = new protocol.SecretChatCodec({
    maxBytes: 32,
    maxDepth: 2,
    maxVector: 1,
  });
  assert.throws(() => codec.encode({ _: 'help.getConfig' }), /Unknown TL/);
  assert.throws(
    () =>
      codec.encode({
        _: 'decryptedMessage',
        random_id: 1n,
        ttl: 0,
        message: 'x'.repeat(64),
      }),
    /byte limit/i
  );
  assert.throws(
    () => codec.encode({ _: 'decryptedMessageMediaEmpty' }, 'DecryptedMessage'),
    /type/i
  );
});

it('encrypts and decrypts a serialized secret-chat wrapper with the shared envelope primitive', () => {
  const codec = new protocol.SecretChatCodec();
  const key = new Uint8Array(256).fill(17);
  const sender = new protocol.SecretChatCipher(key, { originator: true });
  const receiver = new protocol.SecretChatCipher(key, { originator: false });
  const wrapper = {
    _: 'decryptedMessageLayer',
    random_bytes: new Uint8Array(16),
    layer: 144,
    in_seq_no: 0,
    out_seq_no: 1,
    message: { _: 'decryptedMessage', random_id: 1n, ttl: 0, message: 'Hello' },
  };
  const result = codec.decode(
    receiver.decrypt(sender.encrypt(codec.encode(wrapper)))
  );
  assert.equal(result.message.message, 'Hello');
  assert.equal(result.layer, 144);
  sender.destroy();
  receiver.destroy();
});
