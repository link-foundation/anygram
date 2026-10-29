import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { SecretChatSession } from '../src/mtproto.js';
import { UpdateManager } from '../src/updates.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

it('persists bilateral native TCP secret messages before saving qts and acknowledging the queue', async () => {
  const sides = [];
  const key = Uint8Array.from({ length: 256 }, (_, index) => index);
  const chat = { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n };
  const createSide = async (originator) => {
    const side = {
      session: new SecretChatSession({ key, originator, peer: chat }),
      received: [],
      acknowledged: [],
      qts: 0,
      nextQts: 0,
      durable: null,
    };
    sides.push(side);
    side.rpc = await secretRpcPeer((request) => {
      if (request._ === 'help.getNearestDc') {
        return { _: 'nearestDc', country: 'US', this_dc: 2, nearest_dc: 2 };
      }
      if (request._ === 'messages.receivedQueue') {
        assert.equal(side.qts, request.max_qts);
        assert.equal(side.durable.sequence.incoming, request.max_qts);
        side.acknowledged.push(request.max_qts);
        return [];
      }
      assert.ok(
        ['messages.sendEncrypted', 'messages.sendEncryptedService'].includes(
          request._
        )
      );
      const target = sides.find((other) => other !== side);
      const service = request._ === 'messages.sendEncryptedService';
      target.rpc.push({
        _: 'updateNewEncryptedMessage',
        message: {
          _: service ? 'encryptedMessageService' : 'encryptedMessage',
          random_id: request.random_id,
          chat_id: chat.chat_id,
          date: 1,
          bytes: request.data,
          ...(service ? {} : { file: { _: 'encryptedFileEmpty' } }),
        },
        qts: ++target.nextQts,
      });
      return { _: 'messages.sentEncryptedMessage', date: 1 };
    });
    const manager = new UpdateManager({
      state: { pts: 0, qts: 0, seq: 0, date: 1 },
      invoke: (method, params) => side.rpc.client.call(method, params),
      onUpdate: (update) =>
        side.session.receive(update.message.bytes, {
          save: (state, effects) => {
            side.durable = JSON.parse(JSON.stringify(state));
            side.received.push(...effects.messages);
          },
        }),
      onState: (state) => {
        assert.equal(side.durable.sequence.incoming, state.qts);
        side.qts = state.qts;
      },
    });
    side.rpc.client.onUpdate = (update) => manager.feed(update);
    await side.rpc.client.call('help.getNearestDc');
    return side;
  };
  try {
    const alice = await createSide(true);
    const bob = await createSide(false);
    for (const [sender, receiver, id, text] of [
      [alice, bob, 1n, 'hello'],
      [bob, alice, 2n, 'hello back'],
    ]) {
      const save = (state) => {
        sender.durable = JSON.parse(JSON.stringify(state));
      };
      await sender.session.queue(
        { _: 'decryptedMessage', random_id: id, ttl: 0, message: text },
        { save }
      );
      await sender.session.flush(sender.rpc.client, { save });
      await receiver.rpc.client.pollUpdates();
      await receiver.rpc.client.drainUpdates();
      assert.deepEqual(receiver.acknowledged, [1, 2]);
      assert.equal(receiver.received.at(-1).message.message, text);
      assert.equal(receiver.received.at(-1).message.random_id, id);
      assert.equal(sender.session.pending().length, 0);
    }
    assert.equal(alice.session.exportState().sequence.acknowledged, 2);
    assert.equal(alice.session.exportState().layers.remoteLayer, 144);
    assert.equal(bob.session.exportState().sequence.layer, 144);
  } finally {
    for (const side of sides) {
      await side.rpc?.close();
      side.session.destroy();
    }
  }
});
