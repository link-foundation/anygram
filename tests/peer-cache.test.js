import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { RpcOperations } from '../src/operations.js';

const offline = (options) =>
  new RpcOperations(async () => assert.fail('unexpected RPC'), options);
const fullUser = { _: 'user', id: 21n, access_hash: 23n, first_name: 'Full' };
const minimum = { _: 'user', id: 21n, min: true, access_hash: 999n };

for (const field of [
  'contact',
  'mutual_contact',
  'attach_menu_enabled',
  'bot_can_edit',
  'close_friend',
  'stories_hidden',
  'stories_max_id',
]) {
  it(`preserves protected user ${field} across min updates`, () => {
    const ops = offline();
    const value =
      field === 'stories_max_id' ? { _: 'recentStory', max_id: 5 } : true;
    ops.remember([{ ...fullUser, [field]: value }]);
    ops.remember([minimum]);
    assert.deepEqual(ops.peers.get('user:21')[field], value);
    ops.remember([{ ...minimum, [field]: false }]);
    assert.deepEqual(ops.peers.get('user:21')[field], value);
  });
}
for (const field of [
  'first_name',
  'last_name',
  'username',
  'phone',
  'usernames',
]) {
  it(`preserves complete user ${field} but refreshes min identities`, () => {
    const ops = offline();
    const old =
      field === 'usernames'
        ? [{ _: 'username', username: 'old', active: true }]
        : 'old';
    const next =
      field === 'usernames'
        ? [{ _: 'username', username: 'new', active: true }]
        : 'new';
    ops.remember([{ ...fullUser, [field]: old }]);
    ops.remember([{ ...minimum, [field]: next }]);
    assert.deepEqual(ops.peers.get('user:21')[field], old);
    const fresh = offline();
    fresh.remember([{ ...minimum, [field]: old }]);
    fresh.remember([{ ...minimum, [field]: next }]);
    assert.deepEqual(fresh.peers.get('user:21')[field], next);
    fresh.remember([minimum]);
    assert.equal(fresh.peers.get('user:21')[field], undefined);
  });
}
for (const apply of [false, true]) {
  it(`updates complete user photos only with apply_min_photo=${apply}`, () => {
    const ops = offline();
    const photo = { _: 'userProfilePhoto', photo_id: 41n, dc_id: 2 };
    ops.remember([{ ...fullUser, photo }]);
    ops.remember([{ ...minimum, apply_min_photo: apply }]);
    assert.deepEqual(ops.peers.get('user:21').photo, apply ? undefined : photo);
  });
}
for (const [status, changes] of [
  [{ _: 'userStatusEmpty' }, true],
  [{ _: 'userStatusOffline', was_online: 5 }, false],
]) {
  it(`refreshes min user status from ${status._} according to official rules`, () => {
    const ops = offline();
    ops.remember([{ ...fullUser, status }]);
    ops.remember([
      { ...minimum, status: { _: 'userStatusOnline', expires: 9 } },
    ]);
    assert.deepEqual(
      ops.peers.get('user:21').status,
      changes ? { _: 'userStatusOnline', expires: 9 } : status
    );
  });
}
for (const phone of [undefined, '123', '']) {
  it(`classifies min user hash when phone is ${JSON.stringify(phone)}`, async () => {
    const ops = offline();
    ops.remember([{ ...minimum, ...(phone === undefined ? {} : { phone }) }]);
    if (phone === '') {
      assert.equal((await ops.resolvePeer(21n)).access_hash, 999n);
    } else {
      await assert.rejects(ops.resolvePeer(21n), { type: 'PEER_NOT_FOUND' });
    }
    const complete = offline();
    complete.remember([fullUser]);
    complete.remember([
      { ...minimum, ...(phone === undefined ? {} : { phone }) },
    ]);
    assert.equal(
      (await complete.resolvePeer(21n)).access_hash,
      phone === '' ? 999n : 23n
    );
  });
}
it('keeps a usable hash after a later min update changes the phone field', async () => {
  const ops = offline();
  ops.remember([{ ...minimum, phone: '' }]);
  ops.remember([{ ...minimum, phone: '123', access_hash: 333n }]);
  assert.equal((await ops.resolvePeer(21n)).access_hash, 999n);
});

for (const field of [
  'title',
  'megagroup',
  'color',
  'photo',
  'username',
  'usernames',
  'has_geo',
  'noforwards',
  'emoji_status',
  'has_link',
  'slowmode_enabled',
  'scam',
  'fake',
  'gigagroup',
  'forum',
  'level',
  'restricted',
  'restriction_reason',
  'join_to_send',
  'join_request',
  'verified',
  'default_banned_rights',
  'signature_profiles',
  'autotranslation',
  'broadcast_messages_allowed',
  'monoforum',
  'forum_tabs',
  'linked_monoforum_id',
  'send_paid_messages_stars',
  'bot_verification_icon',
]) {
  it(`applies and clears mutable channel ${field} on min updates`, () => {
    const ops = offline();
    const value =
      {
        title: 'Title',
        username: 'Example',
        color: { _: 'peerColor', color: 1 },
        photo: { _: 'chatPhotoEmpty' },
        usernames: [{ _: 'username', username: 'Extra', active: true }],
        emoji_status: { _: 'emojiStatusEmpty' },
        level: 1,
        restriction_reason: [
          {
            _: 'restrictionReason',
            platform: 'all',
            reason: 'other',
            text: 'Restricted',
          },
        ],
        default_banned_rights: {
          _: 'chatBannedRights',
          until_date: 0,
          send_messages: true,
        },
        linked_monoforum_id: 3n,
        send_paid_messages_stars: 1n,
        bot_verification_icon: 5n,
      }[field] ?? true;
    ops.remember([
      {
        _: 'channel',
        id: 21n,
        access_hash: 23n,
        broadcast: true,
        [field]: value,
      },
    ]);
    ops.remember([{ _: 'channel', id: 21n, min: true }]);
    assert.equal(ops.peers.get('channel:21')[field], undefined);
    ops.remember([{ _: 'channel', id: 21n, min: true, [field]: value }]);
    assert.deepEqual(ops.peers.get('channel:21')[field], value);
    assert.equal(ops.peers.get('channel:21').broadcast, true);
    assert.equal(ops.peers.get('channel:21').access_hash, 23n);
    assert(!ops.peers.get('channel:21').min);
  });
}

it('removes stale username aliases when a complete peer changes its identity', () => {
  const ops = offline();
  ops.remember([{ ...fullUser, username: 'Before' }]);
  ops.remember([{ ...fullUser, username: 'After' }]);
  assert(!ops.peers.has('@before'));
  assert.equal(ops.peers.get('@after'), ops.peers.get('user:21'));
  ops.remember([fullUser]);
  assert(!ops.peers.has('@after'));
});
it('bounds message contexts and resolves retained min mentions without a hash', async () => {
  const ops = offline({ maxPeers: 3 });
  const origin = { _: 'inputPeerChat', chat_id: 31n };
  for (let id = 21n; id < 26n; id++) {
    ops.remember([{ _: 'user', min: true, id }]);
    ops.rememberMessage(
      {
        _: 'message',
        id: 7,
        peer_id: { _: 'peerChat', chat_id: 31n },
        entities: [
          { _: 'messageEntityMentionName', offset: 0, length: 1, user_id: id },
        ],
      },
      origin
    );
  }
  assert.equal(ops.peerContexts.size, 3);
  assert(!ops.peerContexts.has('user:21'));
  assert.deepEqual(await ops.resolvePeer(25n), {
    _: 'inputPeerUserFromMessage',
    peer: origin,
    msg_id: 7,
    user_id: 25n,
  });
});
it('refreshes a min username without a usable hash through contacts.resolveUsername', async () => {
  const calls = [];
  const ops = new RpcOperations(async (request) => {
    calls.push(request);
    return {
      _: 'contacts.resolvedPeer',
      peer: { _: 'peerUser', user_id: 21n },
      chats: [],
      users: [{ ...fullUser, username: 'example' }],
    };
  });
  ops.remember([{ ...minimum, username: 'example' }]);
  assert.equal((await ops.resolvePeer('@example')).access_hash, 23n);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'contacts.resolveUsername');
});
for (const type of ['user', 'channel']) {
  for (const envelope of ['messages', 'updates']) {
    it(`remembers min ${type} source context from raw ${envelope} containers`, async () => {
      const ops = offline();
      const message = {
        _: 'message',
        id: 7,
        peer_id: { _: 'peerUser', user_id: 9n },
        from_id: {
          _: type === 'user' ? 'peerUser' : 'peerChannel',
          [`${type}_id`]: 21n,
        },
      };
      ops.remember({
        _: envelope === 'messages' ? 'messages.messages' : 'updates',
        users: [
          { _: 'user', id: 9n, access_hash: 17n },
          ...(type === 'user' ? [minimum] : []),
        ],
        chats:
          type === 'channel'
            ? [{ _: 'channel', id: 21n, min: true, access_hash: 999n }]
            : [],
        ...(envelope === 'messages'
          ? { messages: [message] }
          : { updates: [{ _: 'updateNewMessage', message }] }),
      });
      const result = await ops.resolvePeer(type === 'user' ? 21n : -10021n);
      assert.equal(
        result._,
        `inputPeer${type === 'user' ? 'User' : 'Channel'}FromMessage`
      );
      assert.equal(result.peer.access_hash, 17n);
      assert.equal(result.msg_id, 7);
    });
  }
}
it('ignores invalid message IDs when retaining peer context', () => {
  const ops = offline();
  for (const id of [0, -1, 1.5, NaN, Infinity, 0x80000000]) {
    ops.rememberMessage(
      {
        _: 'message',
        id,
        peer_id: { _: 'peerChat', chat_id: 31n },
        from_id: { _: 'peerUser', user_id: 21n },
      },
      { _: 'inputPeerChat', chat_id: 31n }
    );
  }
  assert.equal(ops.peerContexts.size, 0);
});
for (const [type, operation, method] of [
  ['User', 'getEntity', 'users.getUsers'],
  ['Channel', 'getEntity', 'channels.getChannels'],
  ['Channel', 'getMessages', 'channels.getMessages'],
  ['Channel', 'deleteMessages', 'channels.deleteMessages'],
  ['Channel', 'markAsRead', 'channels.readHistory'],
]) {
  it(`accepts ${type} message context for ${operation} with the official input constructor`, async () => {
    const calls = [];
    const family = type.toLowerCase();
    const ops = new RpcOperations(async (request) => {
      calls.push(request);
      const entity = { _: family, id: 21n, access_hash: 23n };
      return operation === 'getEntity'
        ? type === 'User'
          ? [entity]
          : { chats: [entity] }
        : { messages: [] };
    });
    const peer = {
      _: `input${type}FromMessage`,
      peer: { _: 'inputPeerChat', chat_id: 31n },
      msg_id: 7,
      [`${family}_id`]: 21n,
    };
    if (operation === 'getEntity') {
      await ops.getEntity(peer);
    } else if (operation === 'getMessages') {
      await ops.getMessages(peer, { ids: 7 });
    } else if (operation === 'deleteMessages') {
      await ops.deleteMessages(peer, [7]);
    } else {
      await ops.markAsRead(peer, 7);
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, method);
    assert.deepEqual(
      calls[0].params.channel ?? calls[0].params.id[0],
      operation === 'getMessages' ||
        operation === 'deleteMessages' ||
        operation === 'markAsRead'
        ? { ...peer, _: 'inputChannelFromMessage' }
        : peer
    );
  });
}
