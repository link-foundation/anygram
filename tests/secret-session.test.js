import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as api from '../src/mtproto.js';

const key = () => Uint8Array.from({ length: 256 }, (_, index) => index);
const peer = { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n };
const message = (id) => ({
  _: 'decryptedMessage',
  random_id: BigInt(id),
  ttl: 0,
  message: `message ${id}`,
});
const session = (options = {}) =>
  new api.SecretChatSession({ key: key(), originator: true, peer, ...options });
const saved = (state) => JSON.parse(JSON.stringify(state));
const save = () => {};
const acceptingClient = () => {
  let id = 0n;
  return {
    callWithReceipt: async () => ({
      value: { _: 'messages.sentEncryptedMessage', date: 1 },
      messageId: (id += 4n),
      dc: 2,
    }),
  };
};
const encryptedFrame = (frame, { originator = false, version = 2 } = {}) => {
  const cipher = new api.SecretChatCipher(key(), { originator, version });
  try {
    return cipher.encrypt(
      new api.SecretChatCodec({ layer: frame.layer }).encode(frame)
    );
  } finally {
    cipher.destroy();
  }
};

it('commits automatic layer notification and encrypted outgoing frames atomically', async () => {
  const sender = session();
  const before = sender.exportState();
  await assert.rejects(sender.queue(message(1)), /save/i);
  await assert.rejects(
    sender.queue(message(1), {
      save: () => {
        throw new Error('disk failed');
      },
    }),
    /disk failed/
  );
  assert.deepEqual(sender.exportState(), before);
  let durable;
  const frame = await sender.queue(message(1), {
    save: (state, effects) => {
      durable = saved(state);
      assert.deepEqual(effects.messages, []);
      assert.equal(state.outbox.length, 2);
      assert.equal(sender.pending().length, 0);
    },
  });
  assert.equal(frame.out_seq_no, 3);
  assert.equal(frame.layer, 46);
  assert.deepEqual(sender.exportState(), durable);
  const pending = sender.pending();
  assert.deepEqual(
    pending.map(({ request }) => request._),
    ['messages.sendEncryptedService', 'messages.sendEncrypted']
  );
  const remote = new api.SecretChatCipher(key(), {
    originator: false,
    version: 1,
  });
  const codec = new api.SecretChatCodec({ layer: 216 });
  const notification = codec.decode(remote.decrypt(pending[0].request.data));
  assert.equal(
    notification.message.action._,
    'decryptedMessageActionNotifyLayer'
  );
  assert.equal(notification.message.action.layer, 144);
  assert.deepEqual(
    codec.decode(remote.decrypt(pending[1].request.data)),
    frame
  );
  pending[1].request.data.fill(0);
  assert.deepEqual(sender.exportState(), durable);
  const restored = new api.SecretChatSession({ state: durable });
  assert.deepEqual(restored.exportState(), durable);
});

it('saves incoming effects with sequence/layer state and rolls back failed transactions', async () => {
  const sender = session();
  const receiver = session({ originator: false });
  await sender.queue(message(1), { save });
  const pending = sender.pending();
  await receiver.receive(pending[0].request.data, { save });
  const before = receiver.exportState();
  await assert.rejects(
    receiver.receive(pending[1].request.data, {
      save: () => {
        throw new Error('transaction failed');
      },
    }),
    /transaction failed/
  );
  assert.deepEqual(receiver.exportState(), before);
  const result = await receiver.receive(pending[1].request.data, {
    save: (state, effects) => {
      assert.equal(state.sequence.incoming, 2);
      assert.equal(effects.messages[0].message.random_id, 1n);
    },
  });
  assert.equal(result.messages[0].message.message, 'message 1');
  assert.equal(
    (await receiver.receive(pending[1].request.data, { save })).duplicate,
    true
  );
  const response = await receiver.queue(
    { ...message(2), grouped_id: 99n },
    { save }
  );
  assert.equal(response.layer, 144);
  for (const item of receiver.pending()) {
    assert.equal(item.version, 2);
    await sender.receive(item.request.data, { save });
  }
  assert.equal(sender.exportState().sequence.layer, 144);
  assert.equal(sender.exportState().sequence.acknowledged, 2);
});

it('replays exact durable packets after ambiguous RPC and persistence failures while chaining receipts', async () => {
  const sender = session({ remoteLayer: 144 });
  await sender.queue(message(1), { save });
  const durable = saved(sender.exportState());
  const pending = sender.pending();
  const calls = [];
  let failNetwork = true;
  const client = {
    callWithReceipt: async (method, params, options) => {
      calls.push({ method, params, options });
      if (failNetwork) {
        throw new Error('connection lost');
      }
      return {
        value: { _: 'messages.sentEncryptedMessage', date: calls.length },
        messageId: BigInt(calls.length) * 4n,
        dc: 2,
      };
    },
  };
  await assert.rejects(sender.flush(client, { save }), /connection lost/);
  assert.deepEqual(sender.exportState(), durable);
  const restored = new api.SecretChatSession({ state: durable });
  failNetwork = false;
  await assert.rejects(
    restored.flush(client, {
      save: () => {
        throw new Error('disk failed');
      },
    }),
    /disk failed/
  );
  assert.deepEqual(restored.exportState(), durable);
  const receipts = await restored.flush(client, { save });
  assert.equal(receipts.length, 2);
  assert.equal(restored.pending().length, 0);
  assert.deepEqual(
    calls.slice(0, 3).map(({ params }) => params.data),
    Array.from({ length: 3 }, () => pending[0].request.data)
  );
  assert.deepEqual(calls[2].options.afterMessageIds, [8n]);
  assert.deepEqual(calls[3].options.afterMessageIds, [12n]);
  assert.equal(calls[3].params.random_id, 1n);
});

it('recovers gaps and exact ciphertext retransmissions across JSON restart', async () => {
  const sender = session({ remoteLayer: 144 });
  const receiver = session({ originator: false, remoteLayer: 144 });
  for (const id of [1, 2, 3]) {
    await sender.queue(message(id), { save });
  }
  const packets = sender.pending();
  await sender.flush(acceptingClient(), { save });
  await receiver.receive(packets[0].request.data, { save });
  const gap = await receiver.receive(packets[3].request.data, { save });
  assert.deepEqual(gap.resend, {
    _: 'decryptedMessageActionResend',
    start_seq_no: 3,
    end_seq_no: 5,
  });
  const durable = saved(receiver.exportState());
  assert.equal(durable.incomingVersions.length, 1);
  const restored = new api.SecretChatSession({ state: durable });
  for (const item of restored.pending()) {
    await sender.receive(item.request.data, { save });
  }
  const retransmissions = sender.pending();
  assert.deepEqual(
    retransmissions.map(({ request }) => request.random_id),
    [1n, 2n]
  );
  assert.deepEqual(
    retransmissions.map(({ request }) => request.data),
    packets.slice(1, 3).map(({ request }) => request.data)
  );
  const first = await restored.receive(retransmissions[0].request.data, {
    save,
  });
  assert.deepEqual(
    first.messages.map(({ message }) => message.random_id),
    [1n]
  );
  const rest = await restored.receive(retransmissions[1].request.data, {
    save,
  });
  assert.deepEqual(
    rest.messages.map(({ message }) => message.random_id),
    [2n, 3n]
  );
  assert.deepEqual(restored.exportState().incomingVersions, []);
  assert.equal(restored.exportState().outbox.length, durable.outbox.length);
});

it('clears authenticated downgrade state durably and retries the remote discard', async () => {
  const receiver = session({ remoteLayer: 144 });
  const remote = new api.SecretChatSequence({ originator: false, layer: 46 });
  const packet = encryptedFrame(remote.create(message(1)), { version: 1 });
  let durable;
  await assert.rejects(
    receiver.receive(packet, {
      save: (state, effects) => {
        durable = saved(state);
        assert.equal(effects.aborted, true);
      },
    }),
    (error) =>
      error.type === 'SECRET_CHAT_ABORTED' &&
      error.cause.type === 'SECRET_CHAT_DOWNGRADE'
  );
  assert.equal(receiver.state.phase, 'aborted');
  assert.equal(durable.key, null);
  assert.equal(durable.sequence, null);
  assert.deepEqual(durable.outbox, []);
  const restored = new api.SecretChatSession({ state: durable });
  let calls = 0;
  const client = {
    callWithReceipt: async (method, params) => {
      calls++;
      assert.equal(method, 'messages.discardEncryption');
      assert.equal(params.chat_id, peer.chat_id);
      return { value: true, messageId: BigInt(calls) * 4n, dc: 2 };
    },
  };
  let saves = 0;
  await assert.rejects(
    restored.flush(client, {
      save: () => {
        if (++saves === 2) {
          throw new Error('disk failed');
        }
      },
    }),
    /disk failed/
  );
  assert.equal(restored.state.discardSubmitted, false);
  await restored.flush(client, { save });
  await restored.flush(client, { save });
  assert.equal(restored.state.discardSubmitted, true);
  assert.equal(calls, 2);
  await assert.rejects(restored.queue(message(2), { save }), /aborted/i);
});

it('keeps unauthenticated packets and storage errors from changing active state', async () => {
  const sender = session({ originator: false, remoteLayer: 144 });
  const receiver = session({ remoteLayer: 144 });
  await sender.queue(message(1), { save });
  const packet = sender.pending()[0].request.data;
  const before = receiver.exportState();
  const broken = Uint8Array.from(packet);
  broken[24] ^= 1;
  await assert.rejects(
    receiver.receive(broken, {
      save: () => assert.fail('Bad packet was saved'),
    }),
    (error) => error.type === 'SECRET_CHAT_BAD_PACKET'
  );
  assert.deepEqual(receiver.exportState(), before);
  const storageError = Object.assign(new Error('storage error'), {
    type: 'SECRET_CHAT_ABORTED',
  });
  await assert.rejects(
    receiver.receive(packet, {
      save: () => {
        throw storageError;
      },
    }),
    (error) => error === storageError
  );
  assert.deepEqual(receiver.exportState(), before);
  await assert.rejects(
    receiver.receive(packet, {
      save: () => {
        throw undefined;
      },
    }),
    (error) => error === undefined
  );
  assert.deepEqual(receiver.exportState(), before);
  await receiver.receive(packet, { save });
  assert.equal(receiver.state.phase, 'active');
});

it('fails closed on authenticated malformed plaintext even when abort persistence fails', async () => {
  const receiver = session({ remoteLayer: 144 });
  const cipher = new api.SecretChatCipher(key(), { originator: false });
  const packet = cipher.encrypt(new Uint8Array(4));
  cipher.destroy();
  await assert.rejects(
    receiver.receive(packet, {
      save: () => {
        throw new Error('disk failed');
      },
    }),
    (error) => {
      assert.equal(error.errors.length, 2);
      assert.equal(error.errors[0].type, 'SECRET_CHAT_ABORTED');
      assert.equal(error.errors[1].message, 'disk failed');
      return true;
    }
  );
  assert.equal(receiver.state.phase, 'aborted');
  assert.equal(receiver.exportState().key, null);
  await assert.rejects(
    receiver.flush(
      {
        callWithReceipt: () => assert.fail('Discard preceded durable abort'),
      },
      {
        save: () => {
          throw new Error('storage unavailable');
        },
      }
    ),
    /storage unavailable/
  );
});

it('copies inputs, rejects concurrent operations and honors cancellation around durable saves', async () => {
  const sender = session();
  const before = sender.exportState();
  const controller = new globalThis.AbortController();
  controller.abort(new Error('cancelled'));
  await assert.rejects(
    sender.queue(message(1), { save, signal: controller.signal }),
    /cancelled/
  );
  assert.deepEqual(sender.exportState(), before);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const input = message(1);
  const running = sender.queue(input, { save: () => gate });
  input.message = 'changed';
  await assert.rejects(sender.notify({ save }), /in progress/);
  assert.throws(() => sender.destroy(), /in progress/);
  release();
  assert.equal((await running).message.message, 'message 1');
  const duringSave = new globalThis.AbortController();
  await sender.queue(message(2), {
    signal: duringSave.signal,
    save: (state) => {
      state.key = null;
      state.outbox = [];
      duringSave.abort();
    },
  });
  assert.equal(sender.exportState().sequence.outgoing, 3);
  assert.equal(sender.pending().length, 3);
  sender.destroy();
  sender.destroy();
  assert.throws(() => sender.pending(), /destroyed/);
  await assert.rejects(sender.notify({ save }), /destroyed/);
});

it('rejects inconsistent or oversized portable session state before exposing queued packets', async () => {
  const sender = session({ remoteLayer: 144 });
  await sender.queue(message(1), { save });
  const state = saved(sender.exportState());
  const changes = [
    (s) => {
      s.version = 2;
    },
    (s) => {
      s.phase = 'waiting';
    },
    (s) => {
      s.originator = 'true';
    },
    (s) => {
      s.peer.chat_id = -1;
    },
    (s) => {
      s.peer.access_hash = 123;
    },
    (s) => {
      s.key = '';
    },
    (s) => {
      s.key = Buffer.alloc(256).toString('base64');
    },
    (s) => {
      s.layers = null;
    },
    (s) => {
      s.sequence = null;
    },
    (s) => {
      s.sequence.layer = 46;
    },
    (s) => {
      s.discardSubmitted = true;
    },
    (s) => {
      s.outbox = [];
    },
    (s) => {
      s.outbox[0].outSequence = 100;
    },
    (s) => {
      s.outbox[0].version = 0;
    },
    (s) => {
      s.outbox[0].submitted = 1;
    },
    (s) => {
      s.outbox[0].data = '!!!!';
    },
    (s) => {
      s.incomingVersions = [[0, 2]];
    },
  ];
  for (const change of changes) {
    const broken = saved(state);
    change(broken);
    assert.throws(() => new api.SecretChatSession({ state: broken }));
  }
  assert.throws(
    () => new api.SecretChatSession({ state, maxBufferedBytes: 256 }),
    /byte|encoding/i
  );
  assert.deepEqual(new api.SecretChatSession({ state }).exportState(), state);
});

it('rolls back count and combined byte limits without consuming outgoing sequence positions', async () => {
  const sender = session({ maxHistory: 2 });
  await sender.queue(message(1), { save });
  const before = sender.exportState();
  await assert.rejects(sender.queue(message(2), { save }), /history limit/);
  assert.deepEqual(sender.exportState(), before);
  await assert.rejects(sender.queue(message(1), { save }), /random ID/);
  assert.deepEqual(sender.exportState(), before);
  const small = session({ maxBufferedBytes: 256 });
  const empty = small.exportState();
  await assert.rejects(
    small.queue({ ...message(1), message: 'a'.repeat(1024) }, { save }),
    /limit/
  );
  assert.deepEqual(small.exportState(), empty);
});

it('replaces unacknowledged ciphertext at the original position and queues a separate deletion atomically', async () => {
  const sender = session();
  await sender.queue(message(1), { save });
  await sender.flush(acceptingClient(), { save });
  const before = sender.exportState();
  await assert.rejects(
    sender.deleteUnacknowledged(3, 2n, {
      save: () => {
        throw new Error('disk failed');
      },
    }),
    /disk failed/
  );
  assert.deepEqual(sender.exportState(), before);
  const output = await sender.deleteUnacknowledged(3, 2n, { save });
  assert.equal(output.replacement.out_seq_no, 3);
  assert.equal(output.deletion.out_seq_no, 5);
  const pending = sender.pending();
  assert.deepEqual(
    pending.map(({ request }) => request.random_id),
    [1n, 2n]
  );
  assert.notDeepEqual(
    pending[0].request.data,
    Buffer.from(before.outbox[1].data, 'base64')
  );
  const receiver = session({ originator: false });
  await receiver.receive(Buffer.from(before.outbox[0].data, 'base64'), {
    save,
  });
  for (const item of pending) {
    const result = await receiver.receive(item.request.data, { save });
    assert.equal(
      result.messages[0].message.action._,
      'decryptedMessageActionDeleteMessages'
    );
    assert.deepEqual(result.messages[0].message.action.random_ids, [1n]);
  }
  assert.deepEqual(
    new api.SecretChatSession({
      state: saved(sender.exportState()),
    }).exportState(),
    sender.exportState()
  );
});

it('evicts acknowledged plaintext and ciphertext together under the combined byte budget', async () => {
  const sender = session({ remoteLayer: 144, maxBufferedBytes: 1024 });
  const receiver = session({ originator: false, remoteLayer: 144 });
  await sender.queue({ ...message(1), message: 'a'.repeat(100) }, { save });
  for (const item of sender.pending()) {
    await receiver.receive(item.request.data, { save });
  }
  await receiver.queue(message(10), { save });
  for (const item of receiver.pending()) {
    await sender.receive(item.request.data, { save });
  }
  assert.equal(sender.exportState().sequence.acknowledged, 2);
  for (const id of [2, 3]) {
    await sender.queue({ ...message(id), message: 'a'.repeat(100) }, { save });
  }
  const state = sender.exportState();
  assert.equal(state.sequence.history.length, 2);
  assert.equal(state.outbox.length, 2);
  assert.deepEqual(
    new api.SecretChatSession({ state, maxBufferedBytes: 1024 }).exportState(),
    state
  );
});

it('keeps accepted dependency receipts private across caller mutation', async () => {
  const sender = session({ remoteLayer: 144 });
  const calls = [];
  const client = {
    callWithReceipt: async (method, params, options) => {
      calls.push(options);
      return {
        value: { _: 'messages.sentEncryptedMessage', date: 1 },
        messageId: BigInt(calls.length) * 4n,
        dc: 2,
      };
    },
  };
  await sender.notify({ save });
  const receipts = await sender.flush(client, { save });
  receipts[0].messageId = 100n;
  receipts[0].dc = 5;
  await sender.queue(message(1), { save });
  await sender.flush(client, { save });
  assert.deepEqual(calls[1].afterMessageIds, [4n]);
  assert.equal(calls[1].dc, 2);
});

it('rejects noncanonical discard flags and pending envelope policy on restore', async () => {
  const sender = session({ remoteLayer: 144 });
  const receiver = session({ originator: false, remoteLayer: 144 });
  await sender.queue(message(1), { save });
  await receiver.receive(sender.pending()[1].request.data, { save });
  const state = saved(receiver.exportState());
  const changes = [
    (s) => {
      delete s.discardSubmitted;
    },
    (s) => {
      s.discardSubmitted = null;
    },
    (s) => {
      s.incomingVersions[0][1] = 1;
    },
    (s) => {
      s.layers.minimumV2Sequence = null;
    },
  ];
  for (const change of changes) {
    const broken = saved(state);
    change(broken);
    assert.throws(() => new api.SecretChatSession({ state: broken }));
  }
  assert.deepEqual(new api.SecretChatSession({ state }).exportState(), state);
});

it('leaves durable packets pending when a native send receipt is malformed', async () => {
  const sender = session({ remoteLayer: 144 });
  await sender.notify({ save });
  const before = sender.exportState();
  const invalid = [
    {
      messageId: 1n,
      dc: 2,
      value: { _: 'messages.sentEncryptedMessage', date: 1 },
    },
    {
      messageId: 4n,
      dc: 0,
      value: { _: 'messages.sentEncryptedMessage', date: 1 },
    },
    { messageId: 4n, dc: 2, value: true },
    {
      messageId: 4n,
      dc: 2,
      value: { _: 'messages.sentEncryptedMessage', date: -1 },
    },
    undefined,
  ];
  for (const receipt of invalid) {
    await assert.rejects(
      sender.flush({ callWithReceipt: async () => receipt }, { save })
    );
    assert.deepEqual(sender.exportState(), before);
  }
  await assert.rejects(sender.flush({}, { save }), /native RPC receipts/);
  await sender.flush(acceptingClient(), { save });
  assert.equal(sender.pending().length, 0);
});

it('upgrades outgoing layers without changing durable older ciphertext', async () => {
  const sender = session({ layer: 46, remoteLayer: 216 });
  await sender.queue(message(1), { save });
  const original = sender.pending();
  const before = sender.exportState();
  await assert.rejects(
    sender.upgradeLayer(144, {
      save: () => {
        throw new Error('disk failed');
      },
    }),
    /disk failed/
  );
  assert.deepEqual(sender.exportState(), before);
  const notification = await sender.upgradeLayer(144, { save });
  assert.equal(notification.layer, 144);
  assert.equal(notification.message.action.layer, 144);
  const pending = sender.pending();
  assert.deepEqual(pending.slice(0, 2), original);
  assert.equal(pending[2].version, 2);
  assert.equal(await sender.upgradeLayer(144, { save }), undefined);
  await assert.rejects(sender.upgradeLayer(46, { save }), /upgrade/);
  const state = saved(sender.exportState());
  assert.deepEqual(new api.SecretChatSession({ state }).pending(), pending);
});
