import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { RpcOperations } from '../src/operations.js';
import {
  messagePage,
  ownedMessage,
} from './fixtures/account-message-models.js';

for (const style of ['gramjs', 'teleproto']) {
  for (const type of ['User', 'Channel']) {
    it(`uses official ${style} ${type} from-message context instead of a min access hash`, async () => {
      const page = messagePage();
      const key = type.toLowerCase();
      page.messages[0].from_id = { _: `peer${type}`, [`${key}_id`]: 21n };
      const minimal = {
        _: key,
        id: 21n,
        min: true,
        access_hash: 999n,
        first_name: 'Minimal',
        title: 'Minimal',
        photo: { _: 'chatPhotoEmpty' },
        date: 1,
      };
      page[type === 'User' ? 'users' : 'chats'].push(minimal);
      const complete = {
        ...minimal,
        min: false,
        access_hash: 23n,
        first_name: 'Complete',
        title: 'Complete',
      };
      const { message, calls } = await ownedMessage(style, page, () =>
        type === 'User'
          ? [complete]
          : { _: 'messages.chats', chats: [complete] }
      );
      assert.equal(message.inputSender._, `inputPeer${type}FromMessage`);
      assert.equal(message.inputSender.msgId, 7);
      assert.equal(message.inputSender.peer.accessHash, 17n);
      const sender = await message.getSender();
      assert.equal(sender.accessHash, 23n);
      assert.equal(sender.min, false);
      assert.equal(message.inputSender.accessHash, 23n);
      assert.equal(calls.length, 1);
      const value = calls[0][1].id[0];
      assert.equal(value._, `input${type}FromMessage`);
      assert.equal(value.msg_id, 7);
      assert.equal(value.peer.access_hash, 17n);
      assert.equal(value[`${key}_id`], 21n);
    });
  }
  it(`bounds ${style} unavailable sender reloads and retains a reusable source-message fallback`, async () => {
    const page = messagePage();
    page.messages[0].from_id = { _: 'peerUser', user_id: 21n };
    const { message, calls } = await ownedMessage(style, page, () => ({
      ...page,
      messages: [],
    }));
    const peer = await message.getInputSender();
    assert.equal(peer._, 'inputPeerUserFromMessage');
    assert.equal(peer.userId, 21n);
    assert.equal(peer.msgId, 7);
    assert.equal(peer.peer.accessHash, 17n);
    assert.deepEqual(await message.getInputSender(), peer);
    assert.equal(calls.length, 1);
  });
  it(`rejects cancelled ${style} peer/forward lookups before cached reads or RPCs`, async () => {
    const page = messagePage();
    page.messages[0].fwd_from = {
      _: 'messageFwdHeader',
      from_id: { _: 'peerUser', user_id: 9n },
      date: 1,
    };
    const { message, calls } = await ownedMessage(style, page);
    const controller = new globalThis.AbortController();
    const reason = new Error('peer cancelled');
    controller.abort(reason);
    for (const target of [message, message.forward]) {
      for (const method of [
        'getChat',
        'getSender',
        'getInputChat',
        'getInputSender',
      ]) {
        await assert.rejects(
          target[method]({ signal: controller.signal }),
          (error) => error === reason
        );
      }
    }
    assert.equal(calls.length, 0);
  });
  it(`preserves ${style} sender lookup errors without another mutation or backend`, async () => {
    const page = messagePage();
    page.messages[0].from_id = { _: 'peerUser', user_id: 21n };
    const { message, calls } = await ownedMessage(style, page, () => {
      throw Object.assign(new Error('CHANNEL_PRIVATE'), { code: 403 });
    });
    await assert.rejects(
      message.getInputSender(),
      (error) => error.type === 'CHANNEL_PRIVATE' && error.backend === 'native'
    );
    assert.equal(calls.length, 1);
  });
  it(`does not invent ${style} forward or bot metadata or a self destination before identification`, async () => {
    const { message, calls } = await ownedMessage(style);
    assert.equal(message.forward, undefined);
    assert.equal(message.viaBot, undefined);
    assert.equal(message.viaInputBot, undefined);
    assert.equal(message.toId, undefined);
    assert.equal(calls.length, 0);
  });
  it(`refreshes a min ${style} chat through its explicit request hash`, async () => {
    const page = messagePage();
    Object.assign(page.users[0], { min: true, access_hash: 999n });
    const { message, calls } = await ownedMessage(style, page, () => [
      { _: 'user', id: 9n, access_hash: 17n, first_name: 'Complete' },
    ]);
    assert.equal(message.chat.min, true);
    assert.equal((await message.getChat()).firstName, 'Complete');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1].id[0].access_hash, 17n);
    assert.equal(await message.getChat(), message.chat);
  });
  it(`retains each ${style} message origin when another message mentions the same min sender`, async () => {
    const page = messagePage();
    page.users.push(
      { _: 'user', id: 21n, min: true, access_hash: 999n },
      { _: 'user', id: 31n, access_hash: 33n }
    );
    page.messages[0].from_id = { _: 'peerUser', user_id: 21n };
    page.messages.push({
      ...page.messages[0],
      id: 8,
      peer_id: { _: 'peerUser', user_id: 31n },
    });
    const { message } = await ownedMessage(style, page);
    assert.equal(message.inputSender.peer.userId, 9n);
    assert.equal(message.inputSender.peer.accessHash, 17n);
    assert.equal(message.inputSender.msgId, 7);
  });
  it(`shares a single ${style} sender reload between concurrent lookups`, async () => {
    const page = messagePage();
    page.messages[0].from_id = { _: 'peerUser', user_id: 21n };
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const { message, calls } = await ownedMessage(style, page, async () => {
      await gate;
      return {
        ...page,
        messages: [],
        users: [...page.users, { _: 'user', id: 21n, access_hash: 23n }],
      };
    });
    const first = message.getInputSender();
    const second = message.getInputSender();
    release();
    const results = await Promise.all([first, second]);
    assert.equal(results[0], results[1]);
    assert.equal(results[0].accessHash, 23n);
    assert.equal(calls.length, 1);
  });
  it(`honors cancellation after the ${style} sender reload without a follow-up fetch`, async () => {
    const page = messagePage();
    page.messages[0].from_id = { _: 'peerUser', user_id: 21n };
    const controller = new globalThis.AbortController();
    const reason = new Error('cancel after response');
    const { message, calls } = await ownedMessage(style, page, () => {
      controller.abort(reason);
      return { ...page, messages: [] };
    });
    await assert.rejects(
      message.getSender({ signal: controller.signal }),
      (error) => error === reason
    );
    assert.equal(calls.length, 1);
  });
}

for (const type of ['user', 'channel']) {
  it(`keeps a complete ${type} identity and access hash when a min constructor arrives`, async () => {
    const operations = new RpcOperations(async () =>
      assert.fail('unnecessary RPC')
    );
    const complete = {
      _: type,
      id: 21n,
      access_hash: 23n,
      first_name: 'Full',
      phone: '123',
      username: 'complete',
      title: 'Full',
      broadcast: true,
      contact: true,
      admin_rights: { _: 'chatAdminRights', delete_messages: true },
    };
    operations.remember([complete]);
    operations.remember([
      {
        _: type,
        id: 21n,
        min: true,
        access_hash: 999n,
        first_name: 'Min',
        phone: '999',
        username: 'minimum',
        title: 'Updated',
        megagroup: true,
      },
    ]);
    const cached = await operations.getEntity({
      _: type === 'user' ? 'inputPeerUser' : 'inputPeerChannel',
      [`${type}_id`]: 21n,
      access_hash: 23n,
    });
    assert.equal(cached.access_hash, 23n);
    assert(!cached.min);
    if (type === 'user') {
      assert.equal(cached.first_name, 'Full');
      assert.equal(cached.phone, '123');
      assert.equal(cached.contact, true);
      assert.equal(cached.username, 'complete');
    } else {
      assert.equal(cached.title, 'Updated');
      assert.equal(cached.broadcast, true);
      assert.equal(cached.megagroup, true);
      assert.equal(cached.username, 'minimum');
      assert.equal(cached.admin_rights.delete_messages, true);
    }
  });
  it(`refuses bare min ${type} hashes without a known message context`, async () => {
    const operations = new RpcOperations(async () =>
      assert.fail('unnecessary RPC')
    );
    operations.remember([{ _: type, id: 21n, min: true, access_hash: 999n }]);
    await assert.rejects(
      operations.resolvePeer({
        _: `peer${type === 'user' ? 'User' : 'Channel'}`,
        [`${type}_id`]: 21n,
      }),
      (error) => error.type === 'PEER_NOT_FOUND'
    );
  });
}
