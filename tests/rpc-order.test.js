import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

it('chains encrypted secret-service RPCs over native TCP with real message receipts', async () => {
  const received = [];
  const peer = await secretRpcPeer((request, receipt) => {
    received.push({ request, ...receipt });
    return received.length === 3
      ? {
          _: 'rpc_error',
          error_code: 400,
          error_message: 'ENCRYPTION_DECLINED',
        }
      : { _: 'messages.sentEncryptedMessage', date: received.length };
  });
  const params = {
    peer: { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n },
    random_id: 1n,
    data: new Uint8Array(40),
  };
  try {
    let previous;
    for (let index = 0; index < 2; index++) {
      const dependencies = previous ? [previous.messageId] : [];
      const receipt = await peer.client.callWithReceipt(
        'messages.sendEncryptedService',
        { ...params, random_id: BigInt(index + 1) },
        { afterMessageIds: dependencies }
      );
      assert.deepEqual(received[index].afterMessageIds, dependencies);
      assert.equal(receipt.messageId, received[index].messageId);
      assert.equal(receipt.dc, 2);
      assert.equal(receipt.value.date, index + 1);
      previous = receipt;
    }
    await assert.rejects(
      peer.client.callWithReceipt('messages.sendEncryptedService', params, {
        afterMessageIds: [previous.messageId],
      }),
      (error) => error.type === 'ENCRYPTION_DECLINED'
    );
    assert.equal(received.length, 3);
    assert.deepEqual(received[2].afterMessageIds, [previous.messageId]);
    assert.equal(received[0].request._, 'messages.sendEncryptedService');
    assert.deepEqual(received[0].request.peer, params.peer);
  } finally {
    await peer.close();
  }
});
