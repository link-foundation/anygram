import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api, Anygram, createAdapter, bold } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { objectRequest, requestOf } from '../src/requests.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import {
  messagePage,
  ownedMessage,
} from './fixtures/account-message-models.js';

for (const style of ['gramjs', 'teleproto']) {
  it(`retrieves and caches ${style} replies through InputMessageReplyTo with one bounded ID fallback`, async () => {
    const { message, calls } = await ownedMessage(
      style,
      messagePage(),
      (_method, params) => ({
        ...messagePage(),
        messages:
          params.id[0]._ === 'inputMessageReplyTo'
            ? []
            : [{ ...messagePage().messages[0], id: 3 }],
      })
    );
    const reply = await message.getReplyMessage();
    assert.equal(reply.id, 3);
    assert.equal(reply.client, message.client);
    assert.equal(await message.getReplyMessage(), reply);
    assert.deepEqual(
      calls.map(([method, params]) => [method, params.id]),
      [
        ['messages.getMessages', [{ _: 'inputMessageReplyTo', id: 7 }]],
        ['messages.getMessages', [{ _: 'inputMessageID', id: 3 }]],
      ]
    );
  });
  it(`extracts ${style} sent messages by random ID without selecting unrelated updates`, async () => {
    const { message } = await ownedMessage(
      style,
      messagePage(),
      (_method, params) => ({
        _: 'updates',
        users: messagePage().users,
        chats: [],
        date: 1,
        seq: 1,
        updates: [
          {
            _: 'updateNewMessage',
            message: { ...messagePage().messages[0], id: 100 },
            pts: 1,
            pts_count: 1,
          },
          { _: 'updateMessageID', random_id: params.random_id, id: 42 },
          {
            _: 'updateNewMessage',
            message: {
              ...messagePage().messages[0],
              id: 42,
              message: params.message,
            },
            pts: 2,
            pts_count: 1,
          },
        ],
      })
    );
    const result = await message.respond({
      message: 'Response',
      randomId: 31n,
    });
    assert.equal(result.id, 42);
    assert.equal(result.rawText, 'Response');
    assert.equal(result.client, message.client);
  });
  it(`constructs ${style} short sent responses with bound origin and caller text`, async () => {
    const { message } = await ownedMessage(style, messagePage(), () => ({
      _: 'updateShortSentMessage',
      out: true,
      id: 42,
      pts: 2,
      pts_count: 1,
      date: 1,
    }));
    const result = await message.reply({ message: 'Reply' });
    assert.equal(result.id, 42);
    assert.equal(result.rawText, 'Reply');
    assert.equal(result.chatId, 9n);
    assert.equal(result.replyToMsgId, 7);
    assert.equal(result.client, message.client);
  });
  it(`returns only the correlated ${style} forward in its destination chat`, async () => {
    const { message, calls } = await ownedMessage(
      style,
      messagePage(),
      (_method, params) => ({
        _: 'updates',
        date: 1,
        seq: 1,
        users: [],
        chats: [],
        updates: [
          { _: 'updateMessageID', random_id: params.random_id[0], id: 42 },
          ...[9n, 21n].map((id) => ({
            _: 'updateNewMessage',
            pts: 1,
            pts_count: 1,
            message: {
              ...messagePage().messages[0],
              id: 42,
              peer_id: { _: 'peerUser', user_id: id },
            },
          })),
        ],
      })
    );
    const result = await message.forwardTo({
      _: 'inputPeerUser',
      user_id: 21n,
      access_hash: 23n,
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].chatId, 21n);
    assert.equal(result[0].client, message.client);
    assert.equal((await result[0].getInputChat()).accessHash, 23n);
    assert.deepEqual(calls[0][1].id, [7]);
    assert.equal(calls[0][1].random_id.length, 1);
  });
  it(`matches ${style} edited responses by both peer and message ID`, async () => {
    const { message } = await ownedMessage(style, messagePage(), () => ({
      _: 'updates',
      date: 1,
      seq: 1,
      users: [],
      chats: [],
      updates: [
        [8, 9n],
        [7, 21n],
        [7, 9n],
      ].map(([id, userId]) => ({
        _: 'updateEditMessage',
        pts: 1,
        pts_count: 1,
        message: {
          ...messagePage().messages[0],
          id,
          peer_id: { _: 'peerUser', user_id: userId },
          message: 'Edited',
        },
      })),
    }));
    const result = await message.edit({ text: 'Edited' });
    assert.equal(result.id, 7);
    assert.equal(result.chatId, 9n);
    assert.equal(result.rawText, 'Edited');
    assert.equal(result.client, message.client);
  });
  it(`binds ${style} pin service responses and retains their source peer`, async () => {
    const { message } = await ownedMessage(style, messagePage(), () => ({
      _: 'updateShort',
      date: 1,
      update: {
        _: 'updateNewMessage',
        pts: 1,
        pts_count: 1,
        message: {
          _: 'messageService',
          id: 42,
          date: 1,
          peer_id: { _: 'peerUser', user_id: 9n },
          action: { _: 'messageActionPinMessage' },
        },
      },
    }));
    const result = await message.pin();
    assert.equal(result._, 'messageService');
    assert.equal(result.rawText, '');
    assert.equal(result.client, message.client);
    assert.equal(result.chatId, 9n);
    assert.equal((await result.getInputChat()).accessHash, 17n);
  });
}

for (const backend of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  it(`binds a reply to exactly the selected ${backend} adapter`, async () => {
    const Vendor = backend === 'gramjs' ? GramApi : TeleApi;
    const calls = [];
    const call = (request) => {
      const input = objectRequest(requestOf(request));
      calls.push(input);
      return input._ === 'messages.getHistory'
        ? messagePage()
        : {
            _: 'updateShortSentMessage',
            out: true,
            id: 42,
            pts: 1,
            pts_count: 1,
            date: 1,
          };
    };
    const client = new Anygram({
      backend,
      adapters: [
        createAdapter(
          'unused',
          { call: () => assert.fail('Wrong backend') },
          { kind: 'mtproto' }
        ),
        createAdapter(
          backend,
          {
            invoke: async (request) => {
              assert(
                request instanceof Vendor.messages.GetHistory ||
                  request instanceof Vendor.messages.SendMessage
              );
              return call(request);
            },
            call: async (method, params) =>
              call(
                typeof method === 'string' ? { _: method, ...params } : method
              ),
          },
          { Api: Vendor, kind: backend === 'native' ? 'mtproto' : backend }
        ),
      ],
    });
    const [message] = await client.teleproto.getMessages(
      new Api.InputPeerUser({ userId: 9n, accessHash: 17n })
    );
    const result = await message.reply({ message: 'Selected', randomId: 31n });
    assert.equal(result.id, 42);
    assert.equal(calls.length, 2);
    assert.equal(BigInt(calls[1].peer.user_id), 9n);
    assert.equal(calls[1].reply_to.reply_to_msg_id, 7);
  });
}

it('delivers source-bound reply, pin, read and deletion over independent encrypted native TCP', async () => {
  const calls = [];
  const peer = await secretRpcPeer((request) => {
    calls.push(request);
    if (request._ === 'messages.getHistory') {
      return messagePage();
    }
    if (
      request._ === 'messages.readHistory' ||
      request._ === 'messages.deleteMessages'
    ) {
      return { _: 'messages.affectedMessages', pts: 1, pts_count: 1 };
    }
    if (request._ === 'messages.sendMessage') {
      return {
        _: 'updateShortSentMessage',
        out: true,
        id: 42,
        pts: 1,
        pts_count: 1,
        date: 1,
      };
    }
    return { _: 'updatesTooLong' };
  });
  const client = new Anygram({
    adapters: [createAdapter('native', peer.client, { kind: 'mtproto' })],
  });
  try {
    const [message] = await client.gramjs.getMessages({
      _: 'inputPeerUser',
      user_id: 9n,
      access_hash: 17n,
    });
    assert.equal((await message.reply({ message: 'TCP' })).id, 42);
    await message.pin({ notify: true });
    assert.equal(await message.markAsRead(), true);
    assert.equal((await message.delete())[0].ptsCount, 1);
    assert.deepEqual(
      calls.map((call) => call._),
      [
        'messages.getHistory',
        'messages.sendMessage',
        'messages.updatePinnedMessage',
        'messages.readHistory',
        'messages.deleteMessages',
      ]
    );
    assert.equal(calls[1].reply_to.reply_to_msg_id, 7);
    assert.equal(calls[4].revoke, false);
  } finally {
    await client.disconnect();
    await peer.close();
  }
});

it('honors pre-aborted reads and mutations without sending or changing source records', async () => {
  const source = messagePage();
  const { message, calls } = await ownedMessage('gramjs', source);
  const controller = new globalThis.AbortController();
  const reason = new Error('message cancelled');
  controller.abort(reason);
  const options = { signal: controller.signal };
  for (const invoke of [
    () => message.getChat(options),
    () => message.getSender(options),
    () => message.getInputChat(options),
    () => message.getReplyMessage(options),
    () => message.reply({ ...options, message: 'cancelled' }),
    () => message.delete(options),
    () => message.pin(options),
    () => message.unpin(options),
    () => message.markAsRead(options),
  ]) {
    await assert.rejects(invoke, (error) => error === reason);
  }
  assert.equal(calls.length, 0);
  message.photo.fileReference[0] = 99;
  assert.equal(source.messages[0].media.photo.file_reference[0], 1);
  assert(!Object.keys(message).includes('client'));
  assert(!Object.keys(message).includes('reply'));
});

it('preserves typed RPC failures without replay or fallback mutations', async () => {
  const { message, calls } = await ownedMessage(
    'teleproto',
    messagePage(),
    () => {
      throw Object.assign(new Error('MESSAGE_ID_INVALID'), {
        error_message: 'MESSAGE_ID_INVALID',
        error_code: 400,
      });
    }
  );
  await assert.rejects(
    message.reply({ message: 'fail' }),
    (error) => error.type === 'MESSAGE_ID_INVALID' && error.backend === 'native'
  );
  assert.equal(calls.length, 1);
});

it('downloads detached message media through the shared bounded file path', async () => {
  const source = messagePage();
  source.messages[0].media = {
    _: 'messageMediaDocument',
    document: {
      _: 'document',
      id: 19n,
      access_hash: 23n,
      file_reference: new Uint8Array([1, 2]),
      size: 3n,
      dc_id: 2,
      mime_type: 'application/octet-stream',
      date: 1,
      attributes: [],
    },
  };
  const { message, calls } = await ownedMessage(
    'gramjs',
    source,
    (_method, params) => {
      assert.equal(params.location._, 'inputDocumentFileLocation');
      assert.equal(params.location.access_hash, 23n);
      return {
        _: 'upload.file',
        type: { _: 'storage.fileUnknown' },
        mtime: 1,
        bytes: new Uint8Array([3, 4, 5]),
      };
    }
  );
  assert.deepEqual(
    await message.downloadMedia({ maxBytes: 10 }),
    new Uint8Array([3, 4, 5])
  );
  assert.equal(calls[0][0], 'upload.getFile');
  assert.equal(calls.length, 1);
});

it('maps account send formatting, preview, schedule and buttons without mutating options', async () => {
  const { message, calls } = await ownedMessage(
    'gramjs',
    messagePage(),
    () => ({
      _: 'updateShortSentMessage',
      out: true,
      id: 42,
      pts: 1,
      pts_count: 1,
      date: 1,
    })
  );
  const options = {
    message: 'Response',
    linkPreview: false,
    schedule: 123,
    formattingEntities: [new Api.MessageEntityBold({ offset: 0, length: 8 })],
    buttons: new Api.ReplyKeyboardHide({ selective: true }),
  };
  const result = await message.respond(options);
  assert.equal(calls[0][1].no_webpage, true);
  assert.equal(calls[0][1].schedule_date, 123);
  assert.equal(calls[0][1].entities[0]._, 'messageEntityBold');
  assert.equal(calls[0][1].reply_markup._, 'replyKeyboardHide');
  assert.equal(options.message, 'Response');
  assert.equal(options.formattingEntities[0].className, 'MessageEntityBold');
  assert.equal(result.getEntitiesText()[0][1], 'Response');
});

it('retains explicit FormattedText entities in short sent message models', async () => {
  const { message } = await ownedMessage('gramjs', messagePage(), () => ({
    _: 'updateShortSentMessage',
    out: true,
    id: 42,
    pts: 1,
    pts_count: 1,
    date: 1,
  }));
  const result = await message.reply({ message: bold('Response') });
  assert.equal(result.rawText, 'Response');
  assert.equal(result.getEntitiesText(Api.MessageEntityBold)[0][1], 'Response');
});

it('does not return an unrelated update when a sent message has no random-ID correlation', async () => {
  const { message } = await ownedMessage('gramjs', messagePage(), () => ({
    _: 'updates',
    date: 1,
    seq: 1,
    users: [],
    chats: [],
    updates: [
      {
        _: 'updateNewMessage',
        message: messagePage().messages[0],
        pts: 1,
        pts_count: 1,
      },
    ],
  }));
  assert.equal(await message.reply({ message: 'Uncorrelated' }), undefined);
});
