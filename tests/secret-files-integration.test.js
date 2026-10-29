import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  SecretChatSession,
  uploadEncryptedFile,
  downloadEncryptedFile,
} from '../src/mtproto.js';
import { UpdateManager } from '../src/updates.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const chat = { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n };

function acknowledgeQueue(side, maxQts) {
  assert.equal(side.qts, maxQts);
  assert.equal(side.durable.sequence.incoming, maxQts);
  if (maxQts === 2) {
    assert.equal(side.messages.at(-1).file.id, 90n);
  }
  if (maxQts === 3) {
    assert.equal(side.durable.messageTTL, 30);
  }
  side.acknowledged.push(maxQts);
  return [];
}

async function createSide(originator, sides, storage) {
  const side = {
    session: new SecretChatSession({
      key: new Uint8Array(256).fill(9),
      originator,
      peer: chat,
      layer: 144,
      remoteLayer: 144,
    }),
    messages: [],
    files: [],
    qts: 0,
    nextQts: 0,
    durable: null,
    acknowledged: [],
  };
  sides.push(side);
  side.save = (state, effects = {}) => {
    side.durable = JSON.parse(JSON.stringify(state));
    side.messages.push(...(effects.messages ?? []));
    side.files.push(...(effects.files ?? []));
  };
  side.rpc = await secretRpcPeer((request) => {
    if (request._ === 'help.getNearestDc') {
      return { _: 'nearestDc', country: 'US', this_dc: 2, nearest_dc: 2 };
    }
    if (request._ === 'upload.saveFilePart') {
      assert.ok(request.file_part < 2 && request.bytes.length <= 1024);
      const parts = storage.get(request.file_id) ?? [];
      parts[request.file_part] = Buffer.from(request.bytes);
      storage.set(request.file_id, parts);
      return true;
    }
    if (request._ === 'upload.getFile') {
      const stored = storage.get(request.location.id);
      assert.equal(request.location.access_hash, stored.file.access_hash);
      return {
        _: 'upload.file',
        type: { _: 'storage.fileUnknown' },
        mtime: 1,
        bytes: stored.data.subarray(
          Number(request.offset),
          Number(request.offset) + request.limit
        ),
      };
    }
    if (request._ === 'messages.receivedQueue') {
      return acknowledgeQueue(side, request.max_qts);
    }
    const fileRequest = request._ === 'messages.sendEncryptedFile';
    const service = request._ === 'messages.sendEncryptedService';
    assert.ok(fileRequest || service);
    let file;
    if (fileRequest) {
      if (request.file._ === 'inputEncryptedFile') {
        file = storage.get(request.file.id).file;
      } else {
        const data = Buffer.concat(storage.get(request.file.id));
        file = {
          _: 'encryptedFile',
          id: 90n,
          access_hash: -7n,
          size: BigInt(data.length),
          dc_id: 2,
          key_fingerprint: request.file.key_fingerprint,
        };
        storage.set(file.id, { file, data });
      }
    }
    sides
      .find((other) => other !== side)
      .rpc.push({
        _: 'updateNewEncryptedMessage',
        qts: ++sides.find((other) => other !== side).nextQts,
        message: {
          _: service ? 'encryptedMessageService' : 'encryptedMessage',
          chat_id: chat.chat_id,
          random_id: request.random_id,
          date: 1,
          bytes: request.data,
          ...(file ? { file } : {}),
        },
      });
    return {
      _: file ? 'messages.sentEncryptedFile' : 'messages.sentEncryptedMessage',
      date: 1,
      ...(file ? { file } : {}),
    };
  });
  const manager = new UpdateManager({
    state: { pts: 0, qts: 0, seq: 0, date: 1 },
    invoke: (method, params) => side.rpc.client.call(method, params),
    onUpdate: (update) =>
      side.session.receive(update.message.bytes, {
        file: update.message.file,
        save: side.save,
      }),
    onState: (state) => {
      assert.equal(side.durable.sequence.incoming, state.qts);
      side.qts = state.qts;
    },
  });
  side.rpc.client.onUpdate = (update) => manager.feed(update);
  await side.rpc.client.call('help.getNearestDc');
  return side;
}

it('uploads, delivers, downloads and forwards secret files through native encrypted TCP before qts acknowledgement', async () => {
  const sides = [];
  const storage = new Map();
  try {
    const alice = await createSide(true, sides, storage);
    const bob = await createSide(false, sides, storage);
    const input = Uint8Array.from({ length: 1025 }, (_, i) => i % 251);
    const upload = await uploadEncryptedFile(
      alice.rpc.client.call.bind(alice.rpc.client),
      input,
      { partSize: 1024 }
    );
    const message = {
      _: 'decryptedMessage',
      random_id: 12n,
      ttl: 0,
      message: '',
      media: {
        _: 'decryptedMessageMediaDocument',
        thumb: new Uint8Array(),
        thumb_w: 0,
        thumb_h: 0,
        mime_type: 'application/octet-stream',
        size: BigInt(input.length),
        key: upload.key,
        iv: upload.iv,
        attributes: [],
        caption: 'file',
      },
    };
    await alice.session.queueFile(message, upload.file, { save: alice.save });
    await alice.session.flush(alice.rpc.client, { save: alice.save });
    assert.equal(alice.files.at(-1).file.id, 90n);
    await bob.rpc.client.pollUpdates();
    await bob.rpc.client.drainUpdates();
    assert.deepEqual(bob.acknowledged, [1, 2]);
    const received = bob.messages.at(-1);
    assert.deepEqual(
      await downloadEncryptedFile(bob.rpc.client.call.bind(bob.rpc.client), {
        ...received.message.media,
        file: received.file,
        size: input.length,
      }),
      Buffer.from(input)
    );
    await bob.session.queueFile(
      { ...received.message, random_id: 14n },
      {
        _: 'inputEncryptedFile',
        id: received.file.id,
        access_hash: received.file.access_hash,
      },
      { save: bob.save }
    );
    await bob.session.flush(bob.rpc.client, { save: bob.save });
    await alice.rpc.client.pollUpdates();
    await alice.rpc.client.drainUpdates();
    assert.deepEqual(alice.acknowledged, [1, 2]);
    assert.equal(alice.messages.at(-1).file.id, 90n);
    assert.equal(alice.messages.at(-1).message.random_id, 14n);
    await alice.session.queueService(
      { _: 'decryptedMessageActionSetMessageTTL', ttl_seconds: 30 },
      { save: alice.save, randomId: 20n }
    );
    await alice.session.flush(alice.rpc.client, { save: alice.save });
    await bob.rpc.client.pollUpdates();
    await bob.rpc.client.drainUpdates();
    assert.equal(bob.session.state.messageTTL, 30);
    await bob.session.queueService(
      { _: 'decryptedMessageActionReadMessages', random_ids: [12n] },
      { save: bob.save, randomId: 21n }
    );
    await bob.session.flush(bob.rpc.client, { save: bob.save });
    await alice.rpc.client.pollUpdates();
    await alice.rpc.client.drainUpdates();
    assert.deepEqual(alice.messages.at(-1).message.action.random_ids, [12n]);
    assert.deepEqual(alice.acknowledged, [1, 2, 3]);
    assert.deepEqual(bob.acknowledged, [1, 2, 3]);
  } finally {
    for (const side of sides) {
      await side.rpc?.close();
      side.session.destroy();
    }
  }
});
