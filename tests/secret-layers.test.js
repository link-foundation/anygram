import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { SecretChatCodec, SecretChatSequence } from '../src/mtproto.js';

const message = (id) => ({
  _: 'decryptedMessage',
  random_id: BigInt(id),
  ttl: 0,
  message: String(id),
});
const sequence = (options = {}) =>
  new SecretChatSequence({ originator: true, layer: 46, ...options });
const wire = (frame) =>
  new SecretChatCodec({ layer: frame.layer }).encode(frame);

it('upgrades outgoing secret layers while preserving exact cached frames across restart and resends', () => {
  const sender = sequence();
  const first = sender.create(message(1));
  sender.upgradeLayer(73);
  const second = sender.create(message(2));
  sender.upgradeLayer(144);
  const third = sender.create(message(3));
  const frames = [first, second, third];
  assert.deepEqual(
    frames.map((frame) => frame.layer),
    [46, 73, 144]
  );
  assert.deepEqual(
    frames.map((frame) => frame.out_seq_no),
    [1, 3, 5]
  );
  assert.deepEqual(
    frames.map((frame) => frame.in_seq_no),
    [0, 0, 0]
  );
  const saved = JSON.parse(JSON.stringify(sender.exportState()));
  assert.equal(saved.layer, 144);
  assert.deepEqual(
    saved.history,
    frames.map((frame) => Buffer.from(wire(frame)).toString('base64'))
  );
  const restored = sequence({ layer: saved.layer, state: saved });
  assert.deepEqual(restored.exportState(), saved);
  assert.deepEqual(restored.unacknowledged(), frames);
  const remote = new SecretChatSequence({ originator: false });
  const request = remote.create({
    _: 'decryptedMessageService',
    random_id: 10n,
    action: {
      _: 'decryptedMessageActionResend',
      start_seq_no: 1,
      end_seq_no: 5,
    },
  });
  assert.deepEqual(restored.receive(request).retransmit, frames);
  assert.deepEqual(restored.exportState().history, saved.history);
});

it('deletes an old-layer unacknowledged message using its original serialization and headers', () => {
  const sender = sequence();
  const original = sender.create(message(1));
  sender.upgradeLayer(144);
  const { replacement, deletion } = sender.deleteUnacknowledged(1, 2n);
  assert.deepEqual({ ...replacement, message: original.message }, original);
  assert.equal(replacement.layer, 46);
  assert.equal(deletion.layer, 144);
  const saved = sender.exportState();
  assert.equal(
    saved.history[0],
    Buffer.from(wire(replacement)).toString('base64')
  );
  assert.equal(
    saved.history[1],
    Buffer.from(wire(deletion)).toString('base64')
  );
  assert.deepEqual(sequence({ layer: 144, state: saved }).unacknowledged(), [
    replacement,
    deletion,
  ]);
});

it('rejects layer downgrades, unsupported upgrades and decreasing persisted history without changing live state', () => {
  const sender = sequence();
  sender.create(message(1));
  const before = sender.exportState();
  for (const layer of [8, 45, 217, NaN, 46.5]) {
    assert.throws(() => sender.upgradeLayer(layer), /layer/i);
    assert.deepEqual(sender.exportState(), before);
  }
  sender.upgradeLayer(46);
  assert.deepEqual(sender.exportState(), before);
  sender.upgradeLayer(144);
  sender.create(message(2));
  const saved = sender.exportState();
  const codec = new SecretChatCodec({ layer: 144 });
  const earlier = codec.decode(Buffer.from(saved.history[0], 'base64'));
  const later = codec.decode(Buffer.from(saved.history[1], 'base64'));
  for (const layers of [
    [144, 46],
    [216, 144],
  ]) {
    const history = [earlier, later].map((frame, index) =>
      Buffer.from(codec.encode({ ...frame, layer: layers[index] })).toString(
        'base64'
      )
    );
    assert.throws(
      () => sequence({ layer: 144, state: { ...saved, history } }),
      /history/i
    );
  }
  sender.destroy();
  assert.throws(() => sender.upgradeLayer(216), /destroyed/i);
});
