import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as protocol from '../src/mtproto.js';

const layers = (options) => new protocol.SecretChatLayers(options);
const frame = (sequence, layer = 46, advertised) => ({
  _: 'decryptedMessageLayer',
  out_seq_no: sequence,
  layer,
  message:
    advertised === undefined
      ? { _: 'decryptedMessage', random_id: 1n, message: 'text', ttl: 0 }
      : {
          _: 'decryptedMessageService',
          random_id: 1n,
          action: { _: 'decryptedMessageActionNotifyLayer', layer: advertised },
        },
});
const downgrade = (error) => error.type === 'SECRET_CHAT_DOWNGRADE';

it('starts at peer layer 46, advertises local support and permits the initial notification race', () => {
  const local = layers();
  assert.deepEqual(local.outgoing, { layer: 46, version: 1 });
  assert.equal(local.needsNotification, true);
  assert.deepEqual(local.notification(), {
    _: 'decryptedMessageActionNotifyLayer',
    layer: 144,
  });
  local.markNotified(144);
  assert.equal(local.needsNotification, false);
  local.observe(frame(1, 46, 144), 1);
  assert.deepEqual(local.outgoing, { layer: 144, version: 2 });
  // The peer may have created these legacy messages before seeing our notify.
  local.observe(frame(3), 1);
  assert.equal(local.exportState().minimumV2Sequence, null);
  local.observe(frame(5, 144), 2);
  assert.throws(() => local.observe(frame(7), 1), downgrade);
});

it('tracks the first modern sequence while allowing older unresolved legacy gaps', () => {
  const local = layers();
  local.observe(frame(9), 2);
  assert.equal(local.exportState().minimumV2Sequence, 9);
  local.observe(frame(7), 1);
  assert.throws(() => local.observe(frame(9), 1), downgrade);
  const before = local.exportState();
  // Discovering an earlier modern packet also detects a queued legacy violation.
  assert.throws(() => local.observe(frame(5), 2), downgrade);
  assert.deepEqual(local.exportState(), before);
  const legacyUpgrade = layers();
  legacyUpgrade.observe(frame(3, 73), 1);
  assert.equal(legacyUpgrade.exportState().minimumV2Sequence, 5);
  legacyUpgrade.observe(frame(1), 1);
  assert.throws(() => legacyUpgrade.observe(frame(5), 1), downgrade);
});

it('observes wrapper layers immediately but processes notify actions only in sequence order', () => {
  const local = layers();
  local.observe(frame(3, 46, 144), 1, { ordered: false });
  assert.deepEqual(local.outgoing, { layer: 46, version: 1 });
  local.observe(frame(3, 46, 144), 1);
  assert.deepEqual(local.outgoing, { layer: 144, version: 2 });
  const wrapper = layers();
  wrapper.observe(frame(5, 144), 2, { ordered: false });
  assert.equal(wrapper.exportState().remoteLayer, 144);
  wrapper.observe(frame(1, 46, 73), 1);
  assert.equal(wrapper.exportState().remoteLayer, 144);
});

it('requires fresh notifications after local upgrades and never lowers known support', () => {
  const local = layers({ layer: 73, remoteLayer: 216 });
  local.markNotified(73);
  local.upgradeLayer(144);
  assert.equal(local.needsNotification, true);
  assert.deepEqual(local.notification(), {
    _: 'decryptedMessageActionNotifyLayer',
    layer: 144,
  });
  assert.deepEqual(local.outgoing, { layer: 144, version: 2 });
  local.markNotified(73);
  assert.equal(local.needsNotification, true);
  local.markNotified(144);
  assert.equal(local.needsNotification, false);
  const before = local.exportState();
  for (const value of [72, 217, NaN, 145.5]) {
    assert.throws(() => local.upgradeLayer(value), /layer/i);
    assert.deepEqual(local.exportState(), before);
  }
  assert.throws(() => local.markNotified(216), /layer/i);
  assert.throws(
    () => local.observe(frame(1, 216), 2),
    (error) => error.type === 'SECRET_CHAT_LAYER_UNSUPPORTED'
  );
});

it('restores copied JSON layer/cutover state and rejects inconsistent snapshots', () => {
  const local = layers();
  local.markNotified(144);
  local.observe(frame(1, 46, 144), 1);
  local.observe(frame(5, 144), 2);
  const saved = JSON.parse(JSON.stringify(local.exportState()));
  const restored = layers({ state: saved });
  assert.deepEqual(restored.exportState(), saved);
  saved.remoteLayer = 46;
  assert.deepEqual(restored.outgoing, { layer: 144, version: 2 });
  assert.throws(() => restored.observe(frame(7), 1), downgrade);
  const snapshot = local.exportState();
  for (const changes of [
    { version: 2 },
    { localLayer: 73 },
    { remoteLayer: 45 },
    { remoteLayer: 0x80000000 },
    { notifiedLayer: 217 },
    { minimumV2Sequence: -1 },
    { minimumV2Sequence: 0x80000002 },
    { highestLegacySequence: 5 },
    { highestLegacySequence: 1.5 },
  ]) {
    assert.throws(() => layers({ state: { ...snapshot, ...changes } }));
  }
});

it('requires modern envelopes from an explicitly agreed starting layer and bounds metadata', () => {
  const local = layers({ remoteLayer: 144 });
  assert.equal(local.exportState().minimumV2Sequence, 0);
  assert.throws(() => local.observe(frame(1), 1), downgrade);
  for (const options of [
    { layer: 45 },
    { layer: 217 },
    { remoteLayer: 45 },
    { remoteLayer: Infinity },
  ]) {
    assert.throws(() => layers(options));
  }
  for (const [value, version] of [
    [frame(-1), 2],
    [frame(1.5), 2],
    [frame(0x80000000), 2],
    [frame(1, 16), 2],
    [frame(1), 0],
    [frame(1), '2'],
    [frame(1, 46, NaN), 2],
  ]) {
    const fresh = layers();
    const before = fresh.exportState();
    assert.throws(() => fresh.observe(value, version));
    assert.deepEqual(fresh.exportState(), before);
  }
});
