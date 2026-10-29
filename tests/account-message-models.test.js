import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { Anygram, createAdapter } from '../src/index.js';
import {
  messagePage,
  sdkMessage,
  canonical,
  wireValue,
} from './fixtures/account-message-models.js';

for (const [style, Vendor] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  for (const [action, args] of [
    ['respond', [{ message: 'Response', silent: true }]],
    ['reply', [{ message: 'Reply', replyTo: 2, silent: true }]],
    ['edit', [{ text: 'Edited' }]],
    ['delete', []],
    ['delete', [{}]],
    ['delete', [{ revoke: false }]],
    ['delete', [{ revoke: true }]],
    ['forwardTo', [{ _: 'inputPeerSelf' }]],
    ['pin', [{ notify: true, pmOneSide: true }]],
    ['unpin', []],
    ['markAsRead', []],
  ]) {
    it(`binds ${style} message ${action} ${JSON.stringify(args)} to its source peer like the actual SDK`, async () => {
      const expected = sdkMessage(Vendor);
      const vendorArgs =
        action === 'forwardTo'
          ? [new Vendor.InputPeerSelf()]
          : globalThis.structuredClone(args);
      await expected.message[action](...vendorArgs);
      assert.equal(expected.calls.length, 1);
      const calls = [];
      const client = new Anygram({
        adapters: [
          createAdapter(
            'native',
            {
              async call(method, params) {
                if (method === 'messages.getHistory') {
                  return messagePage();
                }
                calls.push([method, params]);
                return { _: 'updatesTooLong' };
              },
            },
            { kind: 'mtproto' }
          ),
        ],
      });
      const [message] = await client[style].getMessages({
        _: 'inputPeerUser',
        user_id: 9n,
        access_hash: 17n,
      });
      const original = globalThis.structuredClone(args);
      await message[action](...args);
      assert.deepEqual(args, original, 'Owned helpers retain caller arguments');
      assert.equal(calls.length, 1);
      const [operation, input, data, settings] = expected.calls[0];
      const [method, params] = calls[0];
      if (operation === 'sendMessage') {
        assert.equal(method, 'messages.sendMessage');
        assert.deepEqual(params.peer, canonical(input));
        assert.equal(params.message, data.message);
        assert.equal(params.silent, data.silent);
        assert.equal(params.reply_to?.reply_to_msg_id, data.replyTo);
      } else if (operation === 'editMessage') {
        assert.equal(method, 'messages.editMessage');
        assert.deepEqual(params.peer, canonical(input));
        assert.equal(params.id, data.message);
        assert.equal(params.message, data.text);
        assert.equal(params.no_webpage, !data.linkPreview);
      } else if (operation === 'deleteMessages') {
        assert.equal(method, 'messages.deleteMessages');
        assert.deepEqual(params.id, data);
        assert.equal(params.revoke, settings.revoke ?? style === 'teleproto');
      } else if (operation === 'forwardMessages') {
        assert.equal(method, 'messages.forwardMessages');
        assert.deepEqual(params.to_peer, canonical(input));
        assert.deepEqual(params.from_peer, canonical(data.fromPeer));
        assert.deepEqual(params.id, data.messages);
      } else if (operation === 'markAsRead') {
        assert.equal(method, 'messages.readHistory');
        assert.equal(params.max_id, data);
      } else {
        assert.equal(method, 'messages.updatePinnedMessage');
        assert.equal(params.id, data);
        assert.equal(params.unpin, operation === 'unpinMessage');
        assert.equal(params.silent, !(settings?.notify ?? false));
        assert.equal(params.pm_oneside, settings?.pmOneSide ?? false);
      }
    });
  }
  it(`exposes ${style} source identities and media getters like the actual SDK`, async () => {
    const expected = sdkMessage(Vendor).message;
    const client = new Anygram({
      adapters: [
        createAdapter(
          'native',
          {
            call: async () => messagePage(),
          },
          { kind: 'mtproto' }
        ),
      ],
    });
    const [message] = await client[style].getMessages({
      _: 'inputPeerUser',
      user_id: 9n,
      access_hash: 17n,
    });
    for (const field of [
      'isPrivate',
      'isGroup',
      'isChannel',
      'isReply',
      'replyToMsgId',
      'rawText',
    ]) {
      assert.equal(message[field], expected[field], field);
    }
    for (const field of ['chatId', 'senderId']) {
      assert.equal(message[field], BigInt(expected[field].toString()), field);
    }
    assert.deepEqual(wireValue(message.photo), wireValue(expected.photo));
    assert.deepEqual(
      canonical(await message.getInputChat()),
      canonical(await expected.getInputChat())
    );
  });
}
