import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  SecretChatSession,
  uploadEncryptedFile,
  downloadEncryptedFile,
} from '../src/mtproto.js';
import { TlCodec } from '../src/tl.js';
import { telegramDhPrime as p } from '../experiments/secret-dh-fixtures.mjs';

const key = Uint8Array.from({ length: 256 }, (_, i) => i);
const peer = { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n };
const create = (originator = true, extra = {}) =>
  new SecretChatSession({
    key,
    originator,
    peer,
    layer: 144,
    remoteLayer: 144,
    ...extra,
  });
const save = () => {};
const portable = (value) => JSON.parse(JSON.stringify(value));
async function attachment() {
  const chunks = [];
  const bytes = new Uint8Array([8, 6, 4, 2]);
  const upload = await uploadEncryptedFile(async (_, params) => {
    chunks.push(Buffer.from(params.bytes));
    return true;
  }, bytes);
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
      size: BigInt(upload.size),
      key: upload.key,
      iv: upload.iv,
      attributes: [],
      caption: 'file',
    },
  };
  const file = {
    _: 'encryptedFile',
    id: 90n,
    access_hash: -7n,
    size: BigInt(Buffer.concat(chunks).length),
    dc_id: 4,
    key_fingerprint: upload.file.key_fingerprint,
  };
  return { upload, message, file, bytes, data: Buffer.concat(chunks) };
}

it('persists encrypted file requests before submission and retains exact JSON-restored retries', async () => {
  const sender = create();
  const { upload, message, file } = await attachment();
  const before = sender.exportState();
  await assert.rejects(
    sender.queueFile(message, upload.file, {
      save: () => {
        throw new Error('disk failed');
      },
    }),
    /disk failed/
  );
  assert.deepEqual(sender.exportState(), before);
  const frame = await sender.queueFile(message, upload.file, { save });
  const state = portable(sender.exportState());
  const outgoing = sender
    .pending()
    .find((item) => item.request._ === 'messages.sendEncryptedFile');
  assert.deepEqual(outgoing.request.file, upload.file);
  upload.file.id = 0n;
  message.media.key.fill(0);
  assert.deepEqual(sender.pending().at(-1).request, outgoing.request);
  const restored = new SecretChatSession({ state });
  assert.deepEqual(restored.exportState(), state);
  assert.deepEqual(restored.pending(), sender.pending());
  let id = 0n;
  const sent = [];
  const client = {
    callWithReceipt: async (method, params) => {
      sent.push({ method, params });
      return {
        messageId: (id += 4n),
        dc: 2,
        value:
          method === 'messages.sendEncryptedFile'
            ? { _: 'messages.sentEncryptedFile', date: 1, file }
            : { _: 'messages.sentEncryptedMessage', date: 1 },
      };
    },
  };
  let failed = false;
  await assert.rejects(
    restored.flush(client, {
      save: (next, effects) => {
        if (effects.files?.length && !failed) {
          failed = true;
          throw new Error('receipt save failed');
        }
      },
    }),
    /receipt save failed/
  );
  assert.deepEqual(
    restored.pending().map((p) => p.request._),
    ['messages.sendEncryptedFile']
  );
  let files;
  await restored.flush(client, {
    save: (_, effects) => {
      files = effects.files;
    },
  });
  assert.deepEqual(files, [
    { outSequence: frame.out_seq_no, randomId: 12n, file },
  ]);
  const requests = sent.filter(
    (p) => p.method === 'messages.sendEncryptedFile'
  );
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].params, requests[1].params);
  assert.equal(restored.pending().length, 0);
});

it('persists an out-of-order encrypted attachment with its frame and commits it before advancing qts', async () => {
  const sender = create();
  const receiver = create(false);
  const { upload, message, file, bytes, data } = await attachment();
  await sender.queueFile(message, upload.file, { save });
  const pending = sender.pending();
  const early = await receiver.receive(pending[1].request.data, { file, save });
  assert.equal(early.messages.length, 0);
  const state = portable(receiver.exportState());
  assert.equal(state.incomingFiles.length, 1);
  file.access_hash = 0n;
  const restored = new SecretChatSession({ state });
  const before = restored.exportState();
  await assert.rejects(
    restored.receive(pending[0].request.data, {
      save: () => {
        throw new Error('effect save failed');
      },
    }),
    /effect save failed/
  );
  assert.deepEqual(restored.exportState(), before);
  let committed;
  const result = await restored.receive(pending[0].request.data, {
    save: (next, effects) => {
      assert.equal(next.sequence.incoming, 2);
      assert.equal(next.incomingFiles.length, 0);
      committed = effects.messages.at(-1);
    },
  });
  assert.equal(committed.file.access_hash, -7n);
  assert.deepEqual(result.messages.at(-1), committed);
  const downloaded = await downloadEncryptedFile(
    async () => ({ _: 'upload.file', bytes: data }),
    {
      file: committed.file,
      ...committed.message.media,
      size: Number(committed.message.media.size),
    }
  );
  assert.deepEqual(downloaded, Buffer.from(bytes));
  assert.equal(
    (await restored.receive(pending[1].request.data, { save })).duplicate,
    true
  );
});

it('rejects secret media without a file and wrong file bindings without changing live state', async () => {
  const sender = create();
  const { upload, message, file } = await attachment();
  const before = sender.exportState();
  await assert.rejects(sender.queue(message, { save }), /file/i);
  await assert.rejects(
    sender.queueFile(message, { ...upload.file, key_fingerprint: 0 }, { save }),
    /fingerprint/i
  );
  assert.deepEqual(sender.exportState(), before);
  await sender.queueFile(message, upload.file, { save });
  const receiver = create(false);
  const pending = sender.pending();
  await receiver.receive(pending[0].request.data, { save });
  const accepted = receiver.exportState();
  await assert.rejects(
    receiver.receive(pending[1].request.data, {
      file: { ...file, key_fingerprint: 0 },
      save,
    }),
    /file|fingerprint/i
  );
  assert.deepEqual(receiver.exportState(), accepted);
  await receiver.receive(pending[1].request.data, { file, save });
  assert.equal(receiver.state.phase, 'active');
});

it('binds cached file references to the outbox digest and validates incoming snapshot coverage', async () => {
  const sender = create();
  const receiver = create(false);
  const { upload, message, file } = await attachment();
  await sender.queueFile(message, upload.file, { save });
  const state = portable(sender.exportState());
  const codec = new TlCodec({ maxBytes: 1024 });
  const encoded = Buffer.from(
    codec.encode({ ...upload.file, id: upload.file.id + 1n })
  ).toString('base64');
  for (const mutate of [
    (s) => {
      s.outbox.at(-1).file = null;
    },
    (s) => {
      s.outbox.at(-1).file = encoded;
    },
    (s) => {
      s.outbox.at(-1).file = '!!!!';
    },
    (s) => {
      s.outbox[0].file = s.outbox.at(-1).file;
    },
  ]) {
    const broken = portable(state);
    mutate(broken);
    assert.throws(() => new SecretChatSession({ state: broken }));
  }
  const pending = sender.pending();
  await receiver.receive(pending[1].request.data, { file, save });
  const incoming = portable(receiver.exportState());
  for (const mutate of [
    (s) => {
      s.incomingFiles = [];
    },
    (s) => {
      s.incomingFiles = null;
    },
    (s) => {
      s.incomingFiles.push(s.incomingFiles[0]);
    },
    (s) => {
      s.incomingFiles[0][0] += 2;
    },
    (s) => {
      s.incomingFiles[0][1] = null;
    },
    (s) => {
      s.incomingFiles[0].pop();
    },
    (s) => {
      s.incomingFiles[0][2] = 'invalid';
    },
    (s) => {
      s.incomingFiles[0][1] = Buffer.from(
        codec.encode({ ...file, key_fingerprint: 0 })
      ).toString('base64');
    },
    (s) => {
      s.incomingFiles[0][1] = Buffer.from(
        codec.encode({ ...file, id: file.id + 1n })
      ).toString('base64');
    },
  ]) {
    const broken = portable(incoming);
    mutate(broken);
    assert.throws(() => new SecretChatSession({ state: broken }));
  }
});

function buffered(state) {
  const size = (value) => (value ? Buffer.from(value, 'base64').length : 0);
  return (
    [...state.sequence.history, ...state.sequence.pending].reduce(
      (sum, bytes) => sum + size(bytes),
      0
    ) +
    state.outbox.reduce(
      (sum, packet) =>
        sum +
        size(packet.data) +
        size(packet.replacement?.data) +
        size(packet.file),
      0
    ) +
    state.incomingFiles.reduce((sum, [, file]) => sum + size(file), 0) +
    state.incomingDates.length * 4
  );
}

it('counts attachment metadata in the combined budget for outgoing and pending incoming frames', async () => {
  const sender = create(true, { dh: { p, g: 3 } });
  const receiver = create(false);
  const { upload, message, file } = await attachment();
  await sender.queueFile(message, upload.file, { save });
  await receiver.receive(sender.pending()[1].request.data, {
    file,
    date: 1,
    save,
  });
  for (const state of [sender.exportState(), receiver.exportState()]) {
    const bytes = buffered(state);
    assert.deepEqual(
      new SecretChatSession({ state, maxBufferedBytes: bytes }).exportState(),
      state
    );
    assert.throws(
      () => new SecretChatSession({ state, maxBufferedBytes: bytes - 1 }),
      /limit|packet|encoding/i
    );
  }
});

it('removes the file reference when replacing an unacknowledged attachment with a deletion', async () => {
  for (const options of [{}, { dh: { p, g: 3 } }]) {
    const sender = create(true, options);
    const receiver = create(false);
    const { upload, message } = await attachment();
    const frame = await sender.queueFile(message, upload.file, { save });
    const before = portable(sender.exportState());
    await assert.rejects(
      sender.deleteUnacknowledged(frame.out_seq_no, 13n, {
        save: () => {
          throw new Error('delete save failed');
        },
      }),
      /delete save failed/
    );
    assert.deepEqual(sender.exportState(), before);
    await sender.deleteUnacknowledged(frame.out_seq_no, 13n, { save });
    assert.equal(
      sender
        .exportState()
        .outbox.find((entry) => entry.outSequence === frame.out_seq_no).file,
      null
    );
    for (const packet of sender.pending()) {
      assert.equal(packet.request._, 'messages.sendEncryptedService');
      assert.equal(packet.request.file, undefined);
      await receiver.receive(packet.request.data, { save });
    }
    const restored = new SecretChatSession({
      state: portable(sender.exportState()),
    });
    assert.deepEqual(restored.pending(), sender.pending());
  }
});

it('accepts reusable and big-upload references and rejects malformed file receipts before submission state changes', async () => {
  const { upload, message, file } = await attachment();
  for (const input of [
    { _: 'inputEncryptedFile', id: file.id, access_hash: file.access_hash },
    {
      _: 'inputEncryptedFileBigUploaded',
      id: upload.file.id,
      parts: 1,
      key_fingerprint: file.key_fingerprint,
    },
  ]) {
    const sender = create();
    await sender.notify({ save });
    const normal = {
      callWithReceipt: async () => ({
        messageId: 4n,
        dc: 2,
        value: { _: 'messages.sentEncryptedMessage', date: 1 },
      }),
    };
    await sender.flush(normal, { save });
    await sender.queueFile(message, input, { save });
    const before = sender.exportState();
    for (const value of [
      { _: 'messages.sentEncryptedMessage', date: 1 },
      { _: 'messages.sentEncryptedFile', date: -1, file },
      {
        _: 'messages.sentEncryptedFile',
        date: 1,
        file: { _: 'encryptedFileEmpty' },
      },
      {
        _: 'messages.sentEncryptedFile',
        date: 1,
        file: { ...file, key_fingerprint: 0 },
      },
      { _: 'messages.sentEncryptedFile', date: 1, file: { ...file, size: 1n } },
      {
        _: 'messages.sentEncryptedFile',
        date: 1,
        file: { ...file, id: 1n << 64n },
      },
    ]) {
      await assert.rejects(
        sender.flush(
          {
            callWithReceipt: async () => ({
              messageId: 8n,
              dc: 2,
              value,
            }),
          },
          { save }
        )
      );
      assert.deepEqual(sender.exportState(), before);
    }
    await sender.flush(
      {
        callWithReceipt: async () => ({
          messageId: 8n,
          dc: 2,
          value: { _: 'messages.sentEncryptedFile', date: 1, file },
        }),
      },
      { save }
    );
    assert.equal(sender.pending().length, 0);
  }
});

it('sends document sizes through the initial legacy layer without narrowing oversized media or changing callers', async () => {
  const sender = create(true, { remoteLayer: 46 });
  const receiver = create(false, { remoteLayer: 46 });
  const { upload, message, file } = await attachment();
  const frame = await sender.queueFile(message, upload.file, { save });
  assert.equal(frame.layer, 46);
  assert.equal(frame.message.media.size, 4);
  assert.equal(message.media.size, 4n);
  for (const packet of sender.pending()) {
    await receiver.receive(packet.request.data, {
      file: packet.request.file ? file : undefined,
      save,
    });
  }
  assert.deepEqual(
    new SecretChatSession({ state: portable(sender.exportState()) }).pending(),
    sender.pending()
  );
  const before = sender.exportState();
  await assert.rejects(
    sender.queueFile(
      {
        ...message,
        random_id: 13n,
        media: { ...message.media, size: 1n << 31n },
      },
      upload.file,
      { save }
    ),
    /size|integer/i
  );
  assert.deepEqual(sender.exportState(), before);
});

it('delivers photo, video and audio attachment metadata through their independent media schemas', async () => {
  for (const type of ['Photo', 'Video', 'Audio']) {
    const sender = create();
    const receiver = create(false);
    const { upload, message, file } = await attachment();
    message.media = {
      ...message.media,
      _: `decryptedMessageMedia${type}`,
      size: upload.size,
      w: 10,
      h: 10,
      duration: 1,
    };
    await sender.queueFile(message, upload.file, { save });
    let result;
    for (const entry of sender.pending()) {
      result = await receiver.receive(entry.request.data, {
        file: entry.request.file ? file : undefined,
        save,
      });
    }
    const received = result.messages.at(-1);
    assert.equal(received.message.media._, message.media._);
    assert.equal(received.file.id, file.id);
    assert.deepEqual(received.message.media.key, upload.key);
  }
});

it('removes unacknowledged file contents from retransmissions when application deletion or history clear is queued', async () => {
  for (const name of ['DeleteMessages', 'FlushHistory']) {
    for (const options of [{}, { dh: { p, g: 3 } }]) {
      const sender = create(true, options);
      const receiver = create(false);
      const { upload, message } = await attachment();
      await sender.queueFile(message, upload.file, { save });
      const before = sender.exportState();
      const action = {
        _: `decryptedMessageAction${name}`,
        ...(name === 'DeleteMessages' ? { random_ids: [12n] } : {}),
      };
      await assert.rejects(
        sender.queueService(action, {
          randomId: 13n,
          save: () => {
            throw new Error('application delete save failed');
          },
        }),
        /application delete save failed/
      );
      assert.deepEqual(sender.exportState(), before);
      await sender.queueService(action, { save, randomId: 13n });
      const restored = new SecretChatSession({
        state: portable(sender.exportState()),
      });
      assert.equal(restored.state.sequence.outgoing, 3);
      assert.equal(
        restored.exportState().outbox.every((packet) => packet.file === null),
        true
      );
      for (const packet of restored.pending()) {
        assert.equal(packet.request._, 'messages.sendEncryptedService');
        const received = await receiver.receive(packet.request.data, { save });
        assert.equal(received.messages[0].message._, 'decryptedMessageService');
      }
    }
  }
});
