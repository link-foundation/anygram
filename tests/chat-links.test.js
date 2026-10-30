import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api } from 'telegram';
import { Api as TeleprotoApi } from 'teleproto';
import * as anygram from '../src/index.js';
import { RpcOperations } from '../src/operations.js';
import { gramRequest, requestOf } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const channel = {
  _: 'channel',
  id: 9007199254740993n,
  access_hash: -17n,
  title: 'Exact group',
  username: 'example',
  photo: { _: 'chatPhotoEmpty' },
  date: 1,
};
const updates = () => ({
  _: 'updates',
  updates: [],
  chats: [channel],
  users: [],
  date: 1,
  seq: 1,
});
const joined = () => ({
  _: 'messages.chatInviteJoinResultOk',
  updates: updates(),
});
const resolved = () => ({
  _: 'contacts.resolvedPeer',
  peer: { _: 'peerChannel', channel_id: channel.id },
  chats: [channel],
  users: [],
});
const markedId = `-100${channel.id}`;

it('parses official public chat URL forms, aliases and subdomains without losing message/thread IDs', () => {
  for (const link of [
    'Example',
    '@Example',
    'https://t.me/Example/',
    'http://telegram.me/Example?profile#ignored',
    'telegram.dog/Example',
    'https://example.t.me/',
    'tg:resolve?domain=Example',
    'tg://resolve?domain=Example',
  ]) {
    assert.deepEqual(anygram.parseTelegramLink(link), {
      type: 'public',
      username: 'example',
    });
  }
  for (const link of [
    'https://t.me/Example/12/34',
    'https://example.t.me/34?thread=12',
    'https://telegram.me/Example/34?thread=12',
    'tg://resolve?domain=Example&post=34&thread=12',
  ]) {
    assert.deepEqual(anygram.parseTelegramLink(link), {
      type: 'public',
      username: 'example',
      messageId: 34,
      threadId: 12,
    });
  }
  assert.deepEqual(
    anygram.parseTelegramLink('https://links.example/Example', {
      domains: ['links.example'],
    }),
    { type: 'public', username: 'example' }
  );
  assert.deepEqual(
    anygram.parseTelegramLink('tg://Resolve?domain=Example#ignored text'),
    {
      type: 'public',
      username: 'example',
    }
  );
});

it('preserves invite hash case and separates phone-number links from invite imports', () => {
  for (const link of [
    '+AbC_123-X',
    't.me/+AbC_123-X',
    'https://telegram.me/joinchat/AbC_123-X?x=1#ignored',
    'http://telegram.dog/+AbC_123-X/',
    'tg:join?invite=AbC_123-X',
    'tg://join?invite=AbC_123-X',
  ]) {
    assert.deepEqual(anygram.parseTelegramLink(link), {
      type: 'invite',
      hash: 'AbC_123-X',
    });
  }
  for (const link of [
    '+15550001111',
    'https://t.me/+15550001111',
    'tg://resolve?phone=15550001111',
  ]) {
    assert.deepEqual(anygram.parseTelegramLink(link), {
      type: 'phone',
      phone: '15550001111',
    });
  }
  assert.deepEqual(anygram.parseTelegramLink('tg:join?invite=123456'), {
    type: 'invite',
    hash: '123456',
  });
});

it('parses private message links with exact positive channel IDs and distinct thread IDs', () => {
  for (const link of [
    `t.me/c/${channel.id}/12/34`,
    `https://telegram.me/c/${channel.id}/34?thread=12`,
    `tg:privatepost?channel=${channel.id}&post=34&thread=12`,
  ]) {
    assert.deepEqual(anygram.parseTelegramLink(link), {
      type: 'privateMessage',
      channelId: channel.id,
      messageId: 34,
      threadId: 12,
    });
  }
});

it('rejects untrusted, ambiguous, unsupported and malformed chat links before performing RPCs', async () => {
  const operations = new RpcOperations(() =>
    assert.fail('invalid URL reached RPC')
  );
  for (const link of [
    'https://not-t.me/+AbC',
    'https://t.me.evil.test/+AbC',
    'https://t.me@evil.test/+AbC',
    'https://user:pass@t.me/+AbC',
    'https://t.me:444/+AbC',
    'ftp://t.me/+AbC',
    'https://www.t.me/Example',
    'https://share.t.me/',
    'https://t.me/addlist/list',
    'https://t.me/share?url=example.org',
    'https://t.me/c/0/1',
    'https://t.me/c/9223372036854775808/1',
    'https://t.me/c/1/0',
    'https://t.me/c/1/2147483648',
    'https://t.me/Example/1?thread=0',
    'https://t.me/Example/1/2?thread=3',
    'https://t.me/%ZZ',
    'https://t.me/%2FExample',
    'https://t.me/Example/extra/path',
    'tg://join?invite=AbC&invite=Other',
    'tg://resolve?domain=Example&phone=15550001111',
    'tg://privatepost?channel=1',
    'tg://resolve?domain=Example&direct',
    'tg://join?invite=AbC&domain=Example',
    'x'.repeat(4097),
  ]) {
    assert.throws(() => anygram.parseTelegramLink(link), TypeError, link);
    await assert.rejects(operations.joinChat(link), TypeError, link);
  }
});

it('imports legacy invites and retains layer-232 nested entities for subsequent mute/archive/leave', async () => {
  const requests = [];
  const operations = new RpcOperations(async (request) => {
    requests.push(request);
    return request.method === 'messages.importChatInvite' ? joined() : true;
  });
  assert.deepEqual(
    await operations.joinChat('https://telegram.me/joinchat/AbC_123-X'),
    joined()
  );
  assert.equal(requests[0].params.hash, 'AbC_123-X');
  await operations.muteChat(markedId);
  await operations.archiveChat(markedId);
  await operations.leaveChat(markedId);
  assert.deepEqual(
    requests.map((entry) => entry.method),
    [
      'messages.importChatInvite',
      'account.updateNotifySettings',
      'folders.editPeerFolders',
      'channels.leaveChannel',
    ]
  );
  assert.equal(requests[1].params.peer.peer.access_hash, -17n);
  assert.equal(requests[2].params.folder_peers[0].peer.channel_id, channel.id);
  assert.equal(requests[3].params.channel.access_hash, -17n);
});

it('caches layer-232 join entities without relying on previous dialogs or username resolution', async () => {
  const operations = new RpcOperations(async () => joined());
  await operations.joinChat('https://t.me/+AbC_123-X');
  assert.equal((await operations.getInputEntity(markedId)).access_hash, -17n);
});

it('stops before joining when cancellation arrives during username resolution', async () => {
  const controller = new globalThis.AbortController();
  let calls = 0;
  const operations = new RpcOperations(async () => {
    calls++;
    controller.abort(new Error('lookup cancelled'));
    return resolved();
  });
  await assert.rejects(
    operations.joinChat('@Example', { signal: controller.signal }),
    /lookup cancelled/
  );
  assert.equal(calls, 1);
});

it('resolves public message links once and preserves request cancellation through lookup and joining', async () => {
  const controller = new globalThis.AbortController();
  const requests = [];
  const operations = new RpcOperations(async (request, options) => {
    assert.equal(options.signal, controller.signal);
    requests.push(request);
    return request.method === 'contacts.resolveUsername'
      ? resolved()
      : joined();
  });
  await operations.joinChat('http://telegram.me/Example/12/34', {
    signal: controller.signal,
  });
  assert.equal(requests[0].params.username, 'example');
  assert.equal(requests[1].params.channel.channel_id, channel.id);
  assert.equal((await operations.getInputEntity('@Example')).access_hash, -17n);
  assert.equal(requests.length, 2);

  controller.abort(new Error('stop lookup'));
  await assert.rejects(
    operations.joinChat('@Other', { signal: controller.signal }),
    /stop lookup/
  );
  assert.equal(requests.length, 2);
});

it('never manufactures access hashes or treats private message/phone links as join invitations', async () => {
  const operations = new RpcOperations(() =>
    assert.fail('unexpected join/resolve')
  );
  const link = `https://t.me/c/${channel.id}/123`;
  await assert.rejects(operations.getInputEntity(link), {
    type: 'PEER_NOT_FOUND',
  });
  operations.remember(updates());
  assert.equal((await operations.getInputEntity(link)).access_hash, -17n);
  await assert.rejects(operations.joinChat(link), { type: 'INVITE_REQUIRED' });
  await assert.rejects(operations.joinChat('https://t.me/+15550001111'), {
    type: 'CHAT_LINK_NOT_JOINABLE',
  });
});

it('resolves phone links using contacts.resolvePhone rather than importing their digits', async () => {
  const requests = [];
  const operations = new RpcOperations(async (request) => {
    requests.push(request);
    assert.equal(request.method, 'contacts.resolvePhone');
    assert.equal(request.params.phone, '15550001111');
    return {
      _: 'contacts.resolvedPeer',
      peer: { _: 'peerUser', user_id: 7n },
      users: [{ _: 'user', id: 7n, access_hash: 19n }],
      chats: [],
    };
  });
  assert.equal((await operations.getEntity('t.me/+15550001111')).id, 7n);
  assert.equal((await operations.getInputEntity(7n)).access_hash, 19n);
  assert.equal(requests.length, 1);
});

for (const [kind, BackendApi, response] of [
  ['gramjs', Api, () => gramRequest(Api, requestOf(updates()))],
  [
    'teleproto',
    TeleprotoApi,
    () => gramRequest(TeleprotoApi, requestOf(joined())),
  ],
]) {
  it(`imports and caches joined peers using actual ${kind} constructors`, async () => {
    const requests = [];
    const client = new anygram.Anygram({
      adapters: [
        anygram.createAdapter(
          kind,
          {
            invoke: async (request) => {
              requests.push(request);
              return requests.length === 1 ? response() : true;
            },
          },
          { Api: BackendApi }
        ),
      ],
    });
    await client.joinChat('tg://join?invite=AbC_123-X');
    await client.muteChat(markedId);
    assert.ok(requests[0] instanceof BackendApi.messages.ImportChatInvite);
    assert.equal(requests[0].hash, 'AbC_123-X');
    assert.equal(
      requests[1].peer.peer.channelId.toString(),
      String(channel.id)
    );
    if (kind === 'teleproto') {
      assert.deepEqual(
        new TlCodec().encode({
          _: 'messages.importChatInvite',
          hash: 'AbC_123-X',
        }),
        new Uint8Array(requests[0].getBytes())
      );
    }
  });
}

it('preserves join approval, flood-wait and verification outcomes without replay or fabricated membership', async () => {
  for (const type of [
    'INVITE_REQUEST_SENT',
    'FLOOD_WAIT_60',
    'INVITE_HASH_EXPIRED',
  ]) {
    let calls = 0;
    const failure = new anygram.TelegramError(type, { type });
    const operations = new RpcOperations(async () => {
      calls++;
      throw failure;
    });
    await assert.rejects(
      operations.joinChat('+AbC_123-X'),
      (error) => error === failure
    );
    assert.equal(calls, 1);
  }
  const verification = {
    _: 'messages.chatInviteJoinResultWebView',
    bot_id: 19n,
    query_id: 23n,
    users: [],
  };
  const operations = new RpcOperations(async () => verification);
  assert.deepEqual(await operations.joinChat('+AbC_123-X'), verification);
  await assert.rejects(operations.getInputEntity(markedId), {
    type: 'PEER_NOT_FOUND',
  });
});

it('imports a legacy invite over encrypted native TCP and uses the nested peer for settings', async () => {
  const requests = [];
  const peer = await secretRpcPeer((request) => {
    requests.push(request._);
    if (request._ === 'messages.importChatInvite') {
      assert.equal(request.hash, 'AbC_123-X');
      return joined();
    }
    if (request._ === 'account.updateNotifySettings') {
      assert.equal(request.peer.peer.access_hash, channel.access_hash);
      return true;
    }
    assert.equal(request._, 'folders.editPeerFolders');
    assert.equal(request.folder_peers[0].peer.channel_id, channel.id);
    return updates();
  });
  try {
    const client = new anygram.Anygram({
      adapters: [anygram.createAdapter('mtproto', peer.client)],
    });
    const result = await client.joinChat(
      'https://telegram.me/joinchat/AbC_123-X'
    );
    assert.equal(result._, 'messages.chatInviteJoinResultOk');
    await client.muteChat(markedId);
    await client.archiveChat(markedId);
    assert.deepEqual(requests, [
      'messages.importChatInvite',
      'account.updateNotifySettings',
      'folders.editPeerFolders',
    ]);
  } finally {
    await peer.close();
  }
});
