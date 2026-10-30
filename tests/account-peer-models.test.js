import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import {
  messagePage,
  ownedMessage,
  sdkMessage,
  wireValue,
} from './fixtures/account-message-models.js';

const user = { _: 'user', id: 21n, access_hash: 23n, first_name: 'Original' };
const chat = {
  _: 'chat',
  id: 31n,
  title: 'Chat',
  photo: { _: 'chatPhotoEmpty' },
  participants_count: 2,
  date: 1,
  version: 1,
};
const channel = {
  _: 'channel',
  id: 41n,
  access_hash: 43n,
  title: 'Channel',
  photo: { _: 'chatPhotoEmpty' },
  date: 1,
  broadcast: true,
};

for (const [style, Vendor] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  for (const from of [
    { _: 'peerUser', user_id: 21n },
    { _: 'peerChat', chat_id: 31n },
    { _: 'peerChannel', channel_id: 41n },
    undefined,
  ]) {
    it(`compares actual ${style} forward metadata for ${from?._ ?? 'private origin'}`, async () => {
      const page = messagePage();
      page.users.push(user);
      page.chats.push(chat, channel);
      page.messages[0].fwd_from = {
        _: 'messageFwdHeader',
        from_id: from,
        from_name: from ? undefined : 'Private',
        date: 1,
      };
      const actual = sdkMessage(Vendor, page).message.forward;
      const { message, calls } = await ownedMessage(style, page);
      const forward = message.forward;
      assert(forward);
      assert.equal(forward, message.forward);
      assert.equal(forward.originalFwd, message.fwdFrom);
      assert.equal(forward.client, message.client);
      for (const field of ['chatId', 'senderId']) {
        assert.equal(
          forward[field],
          actual[field] === undefined
            ? undefined
            : BigInt(actual[field].toString()),
          field
        );
      }
      for (const field of ['isPrivate', 'isChannel', 'isGroup']) {
        assert.equal(forward[field], actual[field], field);
      }
      for (const field of ['chat', 'sender', 'inputChat', 'inputSender']) {
        assert.equal(Boolean(forward[field]), Boolean(actual[field]), field);
        if (forward[field]) {
          assert.deepEqual(
            wireValue(forward[field]),
            wireValue(actual[field]),
            field
          );
        }
      }
      assert.equal(await forward.getChat(), forward.chat);
      assert.equal(await forward.getSender(), forward.sender);
      assert.equal(await forward.getInputChat(), forward.inputChat);
      assert.equal(await forward.getInputSender(), forward.inputSender);
      assert(!Object.keys(forward).includes('client'));
      forward.originalFwd.date = 2;
      assert.equal(page.messages[0].fwd_from.date, 1);
      assert.equal(calls.length, 0);
    });
  }
  for (const action of [
    { _: 'messageActionChatCreate', title: 'Created', users: [9n, 21n, 99n] },
    { _: 'messageActionChatAddUser', users: [21n, 9n] },
    { _: 'messageActionChatDeleteUser', user_id: 21n },
    { _: 'messageActionChannelMigrateFrom', title: 'Chat', chat_id: 31n },
    { _: 'messageActionPinMessage' },
  ]) {
    it(`compares actual ${style} ${action._} action entities including missing positions`, async () => {
      const page = messagePage();
      Object.assign(page.messages[0], { _: 'messageService', action });
      page.users.push(user);
      page.chats.push(chat);
      const actual = sdkMessage(Vendor, page).message.actionEntities;
      const { message, calls } = await ownedMessage(style, page);
      assert.deepEqual(
        message.actionEntities?.map(
          (value) => value && [value.className, value.id]
        ),
        actual?.map(
          (value) => value && [value.className, BigInt(value.id.toString())]
        )
      );
      assert.equal(calls.length, 0);
    });
  }
  it(`fixes actual ${style} invite-link inviter lookup using the official user identity`, async () => {
    const page = messagePage();
    page.users.push(user);
    Object.assign(page.messages[0], {
      _: 'messageService',
      action: { _: 'messageActionChatJoinedByLink', inviter_id: 21n },
    });
    const actual = sdkMessage(Vendor, page).message;
    assert.deepEqual(actual.actionEntities, [undefined]);
    const { message } = await ownedMessage(style, page);
    assert.deepEqual(
      message.actionEntities.map((value) => [value._, value.id]),
      [['user', 21n]]
    );
  });
  it(`compares actual ${style} via-bot metadata and copied input hash`, async () => {
    const page = messagePage();
    page.users.push({ ...user, bot: true, bot_info_version: 1 });
    page.messages[0].via_bot_id = 21n;
    const actual = sdkMessage(Vendor, page).message;
    const { message, calls } = await ownedMessage(style, page);
    assert.deepEqual(wireValue(message.viaBot), wireValue(actual.viaBot));
    assert.deepEqual(
      wireValue(message.viaInputBot),
      wireValue(actual.viaInputBot)
    );
    message.viaBot.firstName = 'Detached';
    assert.equal(page.users[1].first_name, 'Original');
    assert.equal(calls.length, 0);
  });
  for (const out of [true, false]) {
    it(`compares actual ${style} destination for out=${out} after self identification`, async () => {
      const page = messagePage();
      page.messages[0].out = out;
      const actual = sdkMessage(Vendor, page).message;
      actual.client._selfInputPeer = new Vendor.InputPeerUser({
        userId: 99n,
        accessHash: 101n,
      });
      const { message, client } = await ownedMessage(style, page, () => [
        { _: 'user', self: true, id: 99n, first_name: 'Self' },
      ]);
      await client[style].getMe();
      assert.deepEqual(wireValue(message.toId), wireValue(actual.toId));
    });
  }
  it(`reloads a missing ${style} sender once and caches the recovered source identity`, async () => {
    const page = messagePage();
    page.messages[0].from_id = { _: 'peerUser', user_id: 21n };
    const loaded = messagePage();
    loaded.messages[0].from_id = page.messages[0].from_id;
    loaded.users.push(user);
    const actual = sdkMessage(Vendor, page).message;
    actual.client.getInputEntity = async () => {
      throw new Error('not cached');
    };
    const requests = [];
    actual.client.getMessages = async (peer, options) => {
      requests.push([peer, options]);
      return [sdkMessage(Vendor, loaded).message];
    };
    assert.equal((await actual.getInputSender()).userId.toString(), '21');
    const { message, calls } = await ownedMessage(style, page, () => loaded);
    assert.equal((await message.getInputSender()).userId, 21n);
    assert.equal((await message.getInputSender()).accessHash, 23n);
    assert.equal((await message.getSender()).id, 21n);
    assert.equal(calls.length, requests.length);
    assert.deepEqual(calls[0][1].id, [{ _: 'inputMessageID', id: 7 }]);
    assert.equal(calls[0][0], 'messages.getMessages');
  });
}
